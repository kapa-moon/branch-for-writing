import { auth } from "@/lib/auth"; // Assuming @ is mapped to src/
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth.handler); 