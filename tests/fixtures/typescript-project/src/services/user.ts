import { User } from '../models/user.js';

export class UserService {
  private users: User[] = [];

  public save(user: User): boolean {
    this.users.push(user);
    console.log("Saved user in TypeScript:", user.username);
    return true;
  }

  public getById(id: string): User | null {
    return this.users.find(u => u.id === id) || null;
  }
}
