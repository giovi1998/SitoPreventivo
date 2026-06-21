import { withApiHandler } from './_lib/handler';
import { handleUsers } from './_routes/users';

export default withApiHandler(handleUsers);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
