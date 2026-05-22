/**
 * Cloudflare Worker - MSTR/BTC Finance API
 */
import { buildFinancePayload } from './finance-data.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET' || !url.pathname.includes('/api/finance')) {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    try {
      const payload = await buildFinancePayload();
      return new Response(JSON.stringify(payload), {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch financial data',
          details: error.message,
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
