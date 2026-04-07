import os
import ssl
import asyncpg
from dotenv import load_dotenv

load_dotenv()

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        db_url = os.environ["DATABASE_URL"]
        # Supabase requires SSL — create a permissive SSL context
        ssl_ctx = None
        if "supabase.com" in db_url:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
        _pool = await asyncpg.create_pool(
            db_url,
            statement_cache_size=0,
            ssl=ssl_ctx,
        )
    return _pool
