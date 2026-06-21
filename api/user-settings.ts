import { withApiHandler } from './_lib/handler';
import { handleUserSettings } from './_routes/userSettings';

export default withApiHandler(handleUserSettings);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
