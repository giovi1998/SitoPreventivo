import { withApiHandler } from '../server/lib/handler';
import { handleHealth } from '../server/routes/health';

export default withApiHandler(handleHealth);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
