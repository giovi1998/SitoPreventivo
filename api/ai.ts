import { withApiHandler } from './_lib/handler';
import { handleAI } from './_routes/ai';

export default withApiHandler(handleAI);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
