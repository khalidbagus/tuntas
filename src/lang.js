import { createContext, useContext } from "react";
import { DEFAULT_LANG } from "./i18n.js";

export const LangContext = createContext(DEFAULT_LANG);
export const useLang = () => useContext(LangContext);
