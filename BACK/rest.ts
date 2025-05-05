import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const dbClient = await new Client().connect({
    hostname: "127.0.0.1", // Try using IP instead of "localhost"
    username: "netUser",
    db: "projetWeb2425",
    password: `${Deno.env.get("NET_DATABASE_PASS")}`,
    port: 3306, // Explicitly set the port
});

//user in db
export const UserExist = async (user: string) => {
    console.log(
        "userExist : ",
        (await dbClient.execute(
            `SELECT count(*) as N FROM User WHERE name = ?`,
            [
                user,
            ],
        )).rows![0].N == 1,
    );
    return (await dbClient.execute(
        `SELECT count(*) as N FROM User WHERE name = ?`,
        [user],
    )).rows![0].N == 1;
};

//get password
// TODO : hash password.
export const UserPassword = async (user: string) => {
    return (await dbClient.execute(
        `SELECT password FROM User WHERE name = ?;`,
        [
            user,
        ],
    )).rows![0].password;
};

//insert user
export const InsertUser = async (user: string, pass: string) => {
    return await dbClient.execute(
        `INSERT INTO User (name, password) VALUES (?, ?);`,
        [user, pass],
    );
};

// TODO : mail regex verification
// TODO : stats insertion
// TODO : party tracking
