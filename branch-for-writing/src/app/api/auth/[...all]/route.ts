import { auth } from "@/lib/auth"; // Assuming @ is mapped to src/
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET, OPTIONS, DELETE, PUT, HEAD, PATCH } = toNextJsHandler(auth); 