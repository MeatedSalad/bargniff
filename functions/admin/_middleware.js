// Seconda serratura per l'admin: vedi functions/_lib/access.js
import { guardAdminArea } from "../_lib/access.js";

export const onRequest = guardAdminArea;
