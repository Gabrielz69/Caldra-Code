import { createContext, useContext } from "react";

export type ShellActions = {
  openProfile: () => void;
  openMaster: () => void;
};

const Ctx = createContext<ShellActions>({ openProfile: () => {}, openMaster: () => {} });

export const ShellActionsProvider = Ctx.Provider;

export function useShellActions() {
  return useContext(Ctx);
}
