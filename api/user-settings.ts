import { withApiHandler } from '../server/lib/handler';
import { handleUserSettings } from '../server/routes/userSettings';

export default withApiHandler(handleUserSettings);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
