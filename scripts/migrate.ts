import {loadConfig} from '../src/config.js';
import {createDb,migrate} from '../src/db.js';
const config=loadConfig();
const db=createDb(config.DATABASE_URL);
await migrate(db);
await db.end();
console.log('Database migrations applied');
