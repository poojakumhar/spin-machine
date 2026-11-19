import { connect, schemaSql } from "./_db.mjs";

const db = await connect();
await db.exec(schemaSql());
console.log(`migrate: ok (${db.label})`);
await db.close();
