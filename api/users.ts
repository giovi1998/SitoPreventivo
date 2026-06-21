import { withApiHandler } from '../server/lib/handler';
import { handleUsers } from '../server/routes/users';

export default withApiHandler(handleUsers);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
