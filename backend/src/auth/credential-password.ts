import * as argon2 from "argon2";

export function hashCredentialPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyCredentialPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}): Promise<boolean> {
  return argon2.verify(hash, password);
}
