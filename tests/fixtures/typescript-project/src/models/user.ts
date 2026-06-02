export interface User {
  id: string;
  username: string;
  email: string;
}

export function createDefaultUser(): User {
  return {
    id: "1",
    username: "guest",
    email: "guest@example.com"
  };
}
