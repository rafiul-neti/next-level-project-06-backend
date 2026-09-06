import { Router } from "express";

const router = Router();

router.post("/initiate");

// payment callback route, bkash only
router.get("/callback");

export const PaymentRoutes = router;
