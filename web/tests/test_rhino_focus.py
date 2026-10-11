import json
import unittest
from unittest.mock import patch, MagicMock
from server import MCP, recover_spawned_rhino_listener


class RhinoFocusTests(unittest.TestCase):
    def client(self, command='/Applications/Rhino 8.app/Contents/MacOS/Rhinoceros'):
        client = MCP.__new__(MCP)
        calls = []
        def request(method, params):
            calls.append(params['name'])
            payload = [{'version': '8', 'pid': 123}] if params['name'] == 'list_slots' else {'slotId': 'new'}
            return {'content': [{'type': 'text', 'text': json.dumps({'payload': payload})}]}
        client.request = request
        return client, calls

    def test_spawn_activates_verified_host(self):
        client, calls = self.client()
        with patch('server.sys.platform', 'darwin'), patch('server.time.sleep'), \
             patch('server.subprocess.check_output', return_value='/Applications/Rhino 8.app/Contents/MacOS/Rhinoceros\n'), \
             patch('server.subprocess.run') as run:
            client.call('spawn_slot', version='8')
        self.assertEqual(calls, ['list_slots', 'spawn_slot'])
        self.assertIn('unix id is 123', run.call_args.args[0][-1])

    def test_pid_reuse_does_not_activate_other_application(self):
        client, calls = self.client()
        with patch('server.sys.platform', 'darwin'), \
             patch('server.subprocess.check_output', return_value='/Applications/Other.app/Other'), \
             patch('server.subprocess.run') as run:
            with self.assertRaises(RuntimeError): client.call('spawn_slot', version='8')
        run.assert_not_called()
        self.assertEqual(calls, ['list_slots'])

    def test_recovers_only_router_spawned_rhino_without_listener(self):
        listeners = MagicMock()
        listeners.glob.side_effect = [[], [MagicMock()]]
        process = ' 456 /Applications/Rhino 8.app/Contents/MacOS/Rhinoceros -nosplash -runscript=_MCPSpawn\n 789 /Applications/Rhino 8.app/Contents/MacOS/Rhinoceros\n'
        with patch('server.sys.platform','darwin'),patch('server.LISTENERS',listeners),patch('server.time.sleep'),\
             patch('server.subprocess.check_output',return_value=process),patch('server.subprocess.run') as run:
            self.assertTrue(recover_spawned_rhino_listener())
        self.assertIn('unix id is 456',run.call_args.args[0][-1])
        self.assertIn('keystroke "_MCPSpawn"',run.call_args.args[0][-1])

    def test_does_not_type_into_user_started_rhino(self):
        process = ' 789 /Applications/Rhino 8.app/Contents/MacOS/Rhinoceros\n'
        with patch('server.sys.platform','darwin'),patch('server.subprocess.check_output',return_value=process),\
             patch('server.subprocess.run') as run:
            self.assertFalse(recover_spawned_rhino_listener())
        run.assert_not_called()
