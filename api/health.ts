import { withApiHandler } from './_lib/handler';
import { handleHealth } from './_routes/health';

export default withApiHandler(handleHealth);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
