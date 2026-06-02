class UserService:
    def __init__(self, db):
        self.db = db

    def save(self, user_data):
        print("Saving user data:", user_data)
        return True

def get_current_user():
    return "john_doe"
