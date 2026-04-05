import { Router } from 'express';
import {
  HTTP_STATUS,
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  PROFILE_PHONE_MAX_LENGTH,
} from '../config/constants.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { httpError } from '../lib/httpError.js';
import { wrapAsync } from '../lib/wrapAsync.js';
import { nextLevelInfo } from '../services/levels.js';
import { hasSixConsecutiveActiveMonths } from '../services/loanEligibility.js';

const router = Router();

/** GET /api/v1/me */
router.get(
  '/',
  wrapAsync(async (req, res) => {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      throw httpError(HTTP_STATUS.NOT_FOUND, 'PROFILE_NOT_FOUND', 'Profil introuvable.');
    }

    const levelMeta = nextLevelInfo(profile.lifetime_deposits_ar);
    const loanEligible = await hasSixConsecutiveActiveMonths(req.user.id);

    res.json({
      data: {
        profile: {
          id: profile.id,
          phone: profile.phone,
          display_name: profile.display_name,
          lifetime_deposits_ar: profile.lifetime_deposits_ar,
          level: profile.level,
          level_progress: levelMeta,
          loan_eligible: loanEligible,
        },
      },
      errors: [],
    });
  }),
);

/** PATCH /api/v1/me */
router.patch(
  '/',
  wrapAsync(async (req, res) => {
    const { phone, display_name } = req.body;
    const patch = {};
    if (phone !== undefined) {
      patch.phone = String(phone).trim().slice(0, PROFILE_PHONE_MAX_LENGTH);
    }
    if (display_name !== undefined) {
      patch.display_name = String(display_name).trim().slice(0, PROFILE_DISPLAY_NAME_MAX_LENGTH);
    }
    if (Object.keys(patch).length === 0) {
      throw httpError(
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        'VALIDATION',
        'Aucun champ à mettre à jour.',
        'body',
      );
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('*')
      .single();

    if (error) throw error;
    const levelMeta = nextLevelInfo(data.lifetime_deposits_ar);
    const loanEligible = await hasSixConsecutiveActiveMonths(req.user.id);

    res.json({
      data: {
        profile: {
          id: data.id,
          phone: data.phone,
          display_name: data.display_name,
          lifetime_deposits_ar: data.lifetime_deposits_ar,
          level: data.level,
          level_progress: levelMeta,
          loan_eligible: loanEligible,
        },
      },
      errors: [],
    });
  }),
);

export default router;
