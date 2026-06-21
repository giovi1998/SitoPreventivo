import { withApiHandler } from './_lib/handler';
import { handleQuotes } from './_routes/quotes';

export default withApiHandler(handleQuotes);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
