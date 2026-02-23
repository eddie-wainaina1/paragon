"""Interactive Python console with everything pre-loaded."""
import code
import logging
import os
import sys

# Ensure the project root (niftyb/) is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env before importing settings
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# Suppress noisy startup logs from the DB/telemetry layers
logging.basicConfig(level=logging.WARNING)

from app.config import settings                                     # noqa: E402
from app.db import connect_db                                       # noqa: E402
from app.constants import Role, OrgType, ContentType, ContentScope, ClassScope  # noqa: E402

from app.models.user import User                                    # noqa: E402
from app.models.organization import Organization                    # noqa: E402
from app.models.content import Content                             # noqa: E402
from app.models.class_ import Class                                # noqa: E402

from app.schemas.user import UserCreate, UserUpdate, UserOut        # noqa: E402
from app.schemas.organization import OrgCreate, OrgUpdate, OrgOut   # noqa: E402
from app.schemas.content import ContentCreate, ContentOut           # noqa: E402
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassOut, ClassDetailOut  # noqa: E402

from app.utils.security import hash_password, verify_password, create_access_token  # noqa: E402

# Build a minimal FastAPI app instance (routers registered, no lifespan)
from fastapi import FastAPI                                         # noqa: E402
from app.routers import auth, users, organizations, content, classes  # noqa: E402

app = FastAPI(title=settings.app_name, version="1.0.0")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(organizations.router, prefix="/api/v1")
app.include_router(content.router, prefix="/api/v1")
app.include_router(classes.router, prefix="/api/v1")

# Connect to MongoDB
connect_db()

BANNER = """
╔═══════════════════════════════════════════════════════╗
║          Nifty by Paragon  —  Python Console          ║
╠═══════════════════════════════════════════════════════╣
║  Models   : User, Organization, Content, Class        ║
║  Schemas  : UserOut, OrgOut, ContentOut, ClassOut ... ║
║  Constants: Role, OrgType, ContentType, ContentScope  ║
║  Security : hash_password, create_access_token        ║
║  Config   : settings                                  ║
║  App      : app  (FastAPI instance)                   ║
║  DB       : connected to {uri}
╚═══════════════════════════════════════════════════════╝
""".format(uri=settings.mongodb_uri)

code.interact(banner=BANNER, local=locals())
