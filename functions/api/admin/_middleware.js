// Seconda serratura per le API dell'admin: vedi functions/_lib/access.js
import { guardAdminArea } from "../../_lib/access.js";

export const onRequest = guardAdminArea;
