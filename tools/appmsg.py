"""Send an AppMessage to an app running in the emulator: appmsg.py <uuid> key=int ..."""

import json, sys, uuid
from libpebble2.communication import PebbleConnection
from libpebble2.communication.transports.websocket import WebsocketTransport
from libpebble2.services.appmessage import AppMessageService, Int32

info = json.load(open("/tmp/pb-emulator.json"))["emery"]
port = next(iter(info.values()))["pypkjs"]["port"]
pebble = PebbleConnection(WebsocketTransport(f"ws://localhost:{port}/"))
pebble.connect()
pebble.run_async()
svc = AppMessageService(pebble)
msg = {int(k): Int32(int(v)) for k, v in (a.split("=") for a in sys.argv[2:])}
svc.send_message(uuid.UUID(sys.argv[1]), msg)
import time

time.sleep(1)
