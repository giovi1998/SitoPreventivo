import { withApiHandler } from '../server/lib/handler';
import { handleQuotes } from '../server/routes/quotes';

export default withApiHandler(handleQuotes);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
