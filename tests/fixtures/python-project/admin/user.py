class UserService:
    def __init__(self, admin_db):
        self.db = admin_db

    def delete_user(self, user_id):
        print("Admin deleting user:", user_id)
        return True
