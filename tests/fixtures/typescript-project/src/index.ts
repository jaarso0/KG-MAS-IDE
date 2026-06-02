import { UserService } from './services/user.js';
import { createDefaultUser } from './models/user.js';

function main() {
  const service = new UserService();
  const guest = createDefaultUser();
  service.save(guest);
}

main();
