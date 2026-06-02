from services.user import UserService, get_current_user
from admin.user import UserService as AdminUserService

def run():
    user = get_current_user()
    service = UserService("db_conn")
    service.save({"name": user})
    
    admin_service = AdminUserService("admin_db_conn")
    admin_service.delete_user(123)

if __name__ == "__main__":
    run()
