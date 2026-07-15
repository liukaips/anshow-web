import type { PermissionKey } from "../auth/permissions.js";

export type AppActor = {
  user: {
    email: string;
    id: string;
  };
  permissions: PermissionKey[];
};

export type AppEnv = {
  Variables: {
    actor?: AppActor;
    requestId: string;
  };
};
