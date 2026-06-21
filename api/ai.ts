import { withApiHandler } from '../server/lib/handler';
import { handleAI } from '../server/routes/ai';

export default withApiHandler(handleAI);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
