export type AppActor = {
  id: string;
};

export type AppEnv = {
  Variables: {
    actor?: AppActor;
    requestId: string;
  };
};
