"""Production entrypoint for D1 Custódia outside Emergent.

The existing server module contains the application and business rules. This
entrypoint swaps only its object-storage functions before FastAPI startup runs,
so photo upload/download/delete use the persistent VPS volume instead of the
Emergent object-storage service.
"""

import server as application
from local_storage import delete_object, get_object, init_storage, put_object


# Route handlers and startup callbacks in server.py resolve these module globals
# at runtime, therefore replacing them here cleanly disconnects production from
# Emergent storage without duplicating the application's business logic.
application.init_storage = init_storage
application.put_object = put_object
application.get_object = get_object
application.delete_object = delete_object
application.storage_key = None
application.EMERGENT_KEY = None
application.STORAGE_URL = "local://persistent-volume"

# Standalone production has a third independent operational sector.
# Existing Guarulhos/São Paulo records remain untouched; this only accepts
# new users and custodies explicitly assigned to Devolução.
application.VALID_REGIONS.add("Devolução")

app = application.app
