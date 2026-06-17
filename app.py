import subprocess
import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MASAI Retrieval Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RetrieveRequest(BaseModel):
    project_path: str
    query: str

@app.post("/retrieve")
def retrieve(request: RetrieveRequest):
    proj_path = os.path.abspath(request.project_path)
    
    cmd = ["npx", "tsx", "scratch/retrieve_json.ts", proj_path, request.query]
    
    try:
        use_shell = os.name == 'nt'
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            shell=use_shell,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        stdout = result.stdout.strip()
        lines = stdout.splitlines()
        json_line = None
        for line in reversed(lines):
            if line.strip().startswith('{') and line.strip().endswith('}'):
                json_line = line.strip()
                break
        
        if not json_line:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse JSON output from retrieval command. Stdout: {stdout}\nStderr: {result.stderr}"
            )
            
        data = json.loads(json_line)
        if "error" in data:
            raise HTTPException(status_code=400, detail=data["error"])
            
        print(f"\n--- [POST /retrieve] ---")
        print(f"Project Path: {proj_path}")
        print(f"Query: {request.query}")
        print(f"Response Payload:\n{json.dumps(data, indent=2)}")
        print(f"------------------------\n")
            
        return data
        
    except subprocess.CalledProcessError as err:
        stderr = err.stderr or err.stdout or ""
        try:
            err_lines = stderr.strip().splitlines()
            for line in reversed(err_lines):
                if line.strip().startswith('{') and line.strip().endswith('}'):
                    err_data = json.loads(line.strip())
                    if "error" in err_data:
                        raise HTTPException(status_code=400, detail=err_data["error"])
        except HTTPException:
            raise
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Error executing retrieval script: {stderr or str(err)}"
        )

class BuildRequest(BaseModel):
    project_path: str

@app.post("/build")
def build(request: BuildRequest):
    proj_path = os.path.abspath(request.project_path)
    
    cmd = ["npm", "run", "dev", "--", proj_path]
    use_shell = os.name == 'nt'
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            shell=use_shell,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        if result.returncode == 0:
            return {"status": "success", "message": "MASAI analysis completed successfully."}
        else:
            # fallback command
            fallback_cmd = ["npx", "tsx", "src/index.ts", proj_path]
            fallback_result = subprocess.run(
                fallback_cmd,
                capture_output=True,
                text=True,
                shell=use_shell,
                cwd=os.path.dirname(os.path.abspath(__file__))
            )
            if fallback_result.returncode == 0:
                return {"status": "success", "message": "MASAI fallback analysis completed successfully."}
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Build failed. Stdout: {fallback_result.stdout}\nStderr: {fallback_result.stderr}"
                )
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
