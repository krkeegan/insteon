from insteon.plm_message import PLM_Message
from insteon.sequences import (ScanDeviceALDBi1, ScanDeviceALDBi2,
    StatusRequest, AddPLMtoDevice, InitializeDevice, WriteALDBRecordi2,
    WriteALDBRecordi1)


class GenericSendHandler(object):
    '''Provides the generic command handling that does not conflict with
    any Insteon devices.  Devices with distinct commands and needs should
    create their own message handler class that inherits and overrides the
    necessary elements'''
    def __init__(self, device):
        # Be careful storing any attributes, this object may be dropped
        # and replaced with a new object in a different class at runtime
        # if the dev_cat changes
        self._device = device
        self._last_sent_msg = None

    #################################################################
    #
    # Outgoing Message Construction
    #
    #################################################################

    def create_message(self, command_name):
        ret = None
        try:
            cmd_schema = self.msg_schema[command_name]
        except KeyError:
            print('command', command_name,
                  'not found for this device. Run DevCat?')
        else:
            command = cmd_schema.copy()
            command['name'] = command_name
            ret = PLM_Message(self._device.plm,
                              device=self._device,
                              plm_cmd='insteon_send',
                              dev_cmd=command)
        return ret

    def send_command(self, command_name, state=''):
        message = self.create_message(command_name)
        if message is not None:
            message.state_machine = state
            self._device.queue_device_msg(message)

    #################################################################
    #
    # Specific Outgoing messages
    #
    #################################################################

    def get_status(self, state_machine=''):
        status_sequence = StatusRequest(self._device)
        status_sequence.start()

    def get_engine_version(self, state_machine=''):
        self.send_command('get_engine_version', state_machine)

    def get_device_version(self, state_machine=''):
        self.send_command('id_request', state_machine)

    def query_aldb(self, success=None, failure=None):
        if self._device.attribute('engine_version') == 0:
            scan_object = ScanDeviceALDBi1(self._device)
        else:
            scan_object = ScanDeviceALDBi2(self._device)
        scan_object.success_callback = success
        scan_object.failure_callback = failure
        scan_object.start()

    def send_all_link_clean(self, group, cmd):
        if cmd == 0x11:
            message = self.create_message('cleanup_on')
        else:
            message = self.create_message('cleanup_off')
        dev_bytes = {'group': group}
        message.insert_bytes_into_raw(dev_bytes)
        self._device.queue_device_msg(message)

    def _state_commands(self):
        ret = {
            'ON': self.create_message('on'),
            'OFF': self.create_message('off')
        }
        return ret

    def state(self, state):
        commands = self._state_commands()
        try:
            msg = commands[state.upper()]
        except KeyError:
            print('This device doesn\'t know the state', state)
        else:
            self._device.queue_device_msg(msg)

    def add_plm_to_dev_link(self):
        '''Create a plm->device link using the manual method, rather than
        inserting the ALDB record into the device.  Generally this needs
        to be used for i2 devices before the modem can talk to them'''
        link_object = AddPLMtoDevice(self._device)
        link_object.start()

    def initialize_device(self):
        '''Automatically called whenever a device is added or the core starts.
        Checks the engine version, whether the device responds to the modem,
        and the device version if they have not previously been requested.
        Always checks the status of the device and sets the proper rcvd, send
        and function handlers.'''
        init_sequence = InitializeDevice(self._device)
        init_sequence.start()


    # ALDB commands
    ######################

    def i2_get_aldb(self, dev_bytes, state_machine=''):
        message = self.create_message('read_aldb')
        message.insert_bytes_into_raw(dev_bytes)
        message.state_machine = state_machine
        self._device.queue_device_msg(message)

    def peek_aldb(self, lsb, state_machine=''):
        '''Sends a peek_one_byte command to the device for the lsb'''
        message = self.create_message('peek_one_byte')
        message.insert_bytes_into_raw({'lsb': lsb})
        message.state_machine = state_machine
        self._device.queue_device_msg(message)

    def create_responder_link(self, linked_device, is_on=True):
        if self._device.engine_version > 0x00:
            link_sequence = WriteALDBRecordi2(self._device)
        else:
            link_sequence = WriteALDBRecordi1(self._device)
        link_sequence.controller = False
        link_sequence.linked_device = linked_device
        on_level = 0x00
        if is_on:
            on_level = 0xFF
        link_sequence.data1 = on_level
        link_sequence.data2 = 0x00
        link_sequence.start()

    def create_controller_link(self, linked_device):
        if self._device.engine_version > 0x00:
            link_sequence = WriteALDBRecordi2(self._device)
        else:
            link_sequence = WriteALDBRecordi1(self._device)
        link_sequence.controller = True
        link_sequence.linked_device = linked_device
        link_sequence.data1 = 0x03
        link_sequence.data2 = 0x00
        link_sequence.start()

    def delete_record(self, address=bytearray(2)):
        if self._device.engine_version > 0x00:
            link_sequence = WriteALDBRecordi2(self._device)
        link_sequence.address = address
        link_sequence.in_use = False
        link_sequence.start()


    def _write_link(self, linked_obj, is_controller):
        if self._device.attribute('engine_version') == 2:
            pass  # run i2cs commands
        else:
            pass  # run i1 commands

    #################################################################
    #
    # Message Schema
    #
    #################################################################

    @property
    def msg_schema(self):
        '''Returns a dictionary of all outgoing message types'''
        schema = {
            'product_data_request': {
                'cmd_1': {'default': 0x03},
                'cmd_2': {'default': 0x00},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'enter_link_mode': {
                'cmd_1': {'default': 0x09},
                'cmd_2': {'default': 0x00,
                          'name': 'group'},
                'usr_1': {'default': 0x00},
                'usr_2': {'default': 0x00},
                'usr_3': {'default': 0x00},
                'usr_4': {'default': 0x00},
                'usr_5': {'default': 0x00},
                'usr_6': {'default': 0x00},
                'usr_7': {'default': 0x00},
                'usr_8': {'default': 0x00},
                'usr_9': {'default': 0x00},
                'usr_10': {'default': 0x00},
                'usr_11': {'default': 0x00},
                'usr_12': {'default': 0x00},
                'usr_13': {'default': 0x00},
                'usr_14': {'default': 0x00},
                'msg_length': 'extended',
                'message_type': 'direct'
            },
            'get_engine_version': {
                'cmd_1': {'default': 0x0D},
                'cmd_2': {'default': 0x00},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'light_status_request': {
                'cmd_1': {'default': 0x19},
                'cmd_2': {'default': 0x00},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'id_request': {
                'cmd_1': {'default': 0x10},
                'cmd_2': {'default': 0x00},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'on': {
                'cmd_1': {'default': 0x11},
                'cmd_2': {'default': 0xFF},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'cleanup_on': {
                'cmd_1': {'default': 0x11},
                'cmd_2': {'default': 0x00,
                          'name': 'group'},
                'msg_length': 'standard',
                'message_type': 'alllink_cleanup'
            },
            'off': {
                'cmd_1': {'default': 0x13},
                'cmd_2': {'default': 0x00},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'cleanup_off': {
                'cmd_1': {'default': 0x13},
                'cmd_2': {'default': 0x00,
                          'name': 'group'},
                'msg_length': 'standard',
                'message_type': 'alllink_cleanup'
            },
            'set_address_msb': {
                'cmd_1': {'default': 0x28},
                'cmd_2': {'default': 0x00,
                          'name': 'msb'},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'poke_one_byte': {
                'cmd_1': {'default': 0x29},
                'cmd_2': {'default': 0x00,
                          'name': 'lsb'},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'peek_one_byte': {
                'cmd_1': {'default': 0x2B},
                'cmd_2': {'default': 0x00,
                          'name': 'lsb'},
                'msg_length': 'standard',
                'message_type': 'direct'
            },
            'read_aldb': {
                'cmd_1': {'default': 0x2F},
                'cmd_2': {'default': 0x00},
                'usr_1': {'default': 0x00},
                'usr_2': {'default': 0x00},
                'usr_3': {'default': 0x00,
                          'name': 'msb'},
                'usr_4': {'default': 0x00,
                          'name': 'lsb'},
                'usr_5': {'default': 0x01,
                          'name': 'num_records'},  # 0x00 = All,0x01 = 1 Record
                'usr_6': {'default': 0x00},
                'usr_7': {'default': 0x00},
                'usr_8': {'default': 0x00},
                'usr_9': {'default': 0x00},
                'usr_10': {'default': 0x00},
                'usr_11': {'default': 0x00},
                'usr_12': {'default': 0x00},
                'usr_13': {'default': 0x00},
                'usr_14': {'default': 0x00},
                'msg_length': 'extended',
                'message_type': 'direct'
            },
            'write_aldb': {
                'cmd_1': {'default': 0x2F},
                'cmd_2': {'default': 0x00},
                'usr_1': {'default': 0x00},
                'usr_2': {'default': 0x02},
                'usr_3': {'default': 0x00,
                          'name': 'msb'},
                'usr_4': {'default': 0x00,
                          'name': 'lsb'},
                'usr_5': {'default': 0x08,
                          'name': 'num_bytes'},
                'usr_6': {'default': 0x00,
                          'name': 'link_flags'},
                'usr_7': {'default': 0x00,
                          'name': 'group'},
                'usr_8': {'default': 0x00,
                          'name': 'dev_addr_hi'},
                'usr_9': {'default': 0x00,
                          'name': 'dev_addr_mid'},
                'usr_10': {'default': 0x00,
                           'name': 'dev_addr_low'},
                'usr_11': {'default': 0x00,
                           'name': 'data_1'},
                'usr_12': {'default': 0x00,
                           'name': 'data_2'},
                'usr_13': {'default': 0x00,
                           'name': 'data_3'},
                'usr_14': {'default': 0x00},
                'msg_length': 'extended',
                'message_type': 'direct'
            }
        }
        return schema