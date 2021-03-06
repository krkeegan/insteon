from insteon_mngr.trigger import InsteonTrigger
from insteon_mngr.sequences.common import SetALDBDelta, BaseSequence, WriteALDBRecord


class ScanDeviceALDBi1(BaseSequence):
    def __init__(self, device=None):
        super().__init__()
        self._device = device

    def start(self):
        self._device.aldb.clear_all_records()
        self._i1_start_aldb_entry_query(0x0F, 0xF8)

    def _i1_start_aldb_entry_query(self, msb, lsb):
        trigger_attributes = {'cmd_2': msb}
        trigger = InsteonTrigger(device=self._device,
                                 command_name='set_address_msb',
                                 attributes=trigger_attributes)
        trigger.trigger_function = lambda: self._send_peek_request(lsb)
        trigger.name = self._device.dev_addr_str + 'query_aldb'
        trigger.queue()
        message = self._device.create_message('set_address_msb')
        message.insert_bytes_into_raw({'msb': msb})
        self._device.queue_device_msg(message)

    def _get_byte_address(self):
        lsb = self._device.last_sent_msg.get_byte_by_name('cmd_2')
        msb_msg = self._device.search_last_sent_msg(
            insteon_cmd='set_address_msb')
        msb = msb_msg.get_byte_by_name('cmd_2')
        aldb_key = self._device.aldb.get_aldb_key(msb, lsb)
        # TODO is this right?  Don't we need to wait until the end of the record?
        if self._device.aldb.get_record(aldb_key).is_last_aldb():
            self._device.aldb.print_records()
            aldb_sequence = SetALDBDelta(group=self._device.base_group)
            aldb_sequence.add_success_callback(lambda: self._on_success())
            aldb_sequence.add_failure_callback(lambda: self._on_failure())
            aldb_sequence.start()
        else:
            dev_bytes = self._device.aldb.get_next_aldb_address(msb, lsb)
            send_handler = self._device.send_handler
            if msb != dev_bytes['msb']:
                send_handler.i1_start_aldb_entry_query(dev_bytes['msb'],
                                                       dev_bytes['lsb'])
            else:
                self._send_peek_request(dev_bytes['lsb'])

    def _send_peek_request(self, lsb):
        trigger = InsteonTrigger(device=self._device,
                                 command_name='peek_one_byte')
        trigger.trigger_function = lambda: self._get_byte_address()
        trigger.name = self._device.dev_addr_str + 'query_aldb'
        trigger.queue()
        message = self._device.create_message('peek_one_byte')
        message.insert_bytes_into_raw({'lsb': lsb})
        self._device.queue_device_msg(message)

class _WriteMSBi1(BaseSequence):
    def __init__(self, device=None):
        super().__init__()
        self._device = device
        self._msb = 0x00

    @property
    def msb(self):
        return self._msb

    @msb.setter
    def msb(self, value):
        self._msb = value

    def aldb_start(self):
        if self._msb == 0x00:
            self._on_failure()
        else:
            trigger_attributes = {'cmd_2': self._msb}
            trigger = InsteonTrigger(device=self._device,
                                     command_name='set_address_msb',
                                     attributes=trigger_attributes)
            trigger.trigger_function = lambda: self._on_success()
            trigger.name = self._device.dev_addr_str + 'set_msb'
            trigger.queue()
            message = self._device.create_message('set_address_msb')
            message.insert_bytes_into_raw({'msb': self._msb})
            self._device.queue_device_msg(message)

class WriteALDBRecordi1(WriteALDBRecord):
    def _perform_write(self, lsb=None):
        if lsb is None:
            lsb = self.address[1] - 0x07  # i1 devices start at low end
        records = self._group.device.aldb.get_all_records()
        aldb_key = self._group.device.aldb.get_aldb_key(self.address[0], self.address[1])
        # This skips bytes that don't need to be written
        if aldb_key in records:
            record = self._group.device.aldb.get_record(
                self._group.device.aldb.get_aldb_key(self.address[0], self.address[1])
            )
            record_parsed = record.parse_record()
            while((lsb % 8 < 7) and
                  self._addr_byte_by_lsb(lsb) ==
                  record_parsed[self._name_position(lsb)]):
                lsb = lsb + 0x01
        if lsb % 8 >= 7 or (lsb % 8 >= 1 and self.in_use is False):
            self._write_complete()
        else:
            trigger = InsteonTrigger(device=self._group.device,
                                     command_name='peek_one_byte')
            trigger.trigger_function = lambda: self._send_poke_request(lsb=lsb)
            trigger.name = self._group.device.dev_addr_str + 'write_aldb'
            trigger.queue()
            message = self._group.device.create_message('peek_one_byte')
            message.insert_bytes_into_raw({'lsb': lsb})
            self._group.device.queue_device_msg(message)

    def _name_position(self, lsb):
        pos = lsb % 8
        positions = ['link_flags', 'group', 'dev_addr_hi', 'dev_addr_mid',
                     'dev_addr_low', 'data_1', 'data_2', 'data_3']
        return positions[pos]

    def _addr_byte_by_lsb(self, lsb):
        msg_attributes = self._compiled_record()
        return msg_attributes[self._name_position(lsb)]

    def _send_poke_request(self, lsb=None):
        lsb_byte = self._addr_byte_by_lsb(lsb)
        trigger_attributes = {'cmd_2': lsb_byte}
        trigger = InsteonTrigger(device=self._group.device,
                                 command_name='poke_one_byte',
                                 attributes=trigger_attributes)
        if (lsb % 8) < 7:
            next_lsb = lsb + 0x01
            callback = lambda: self._perform_write(lsb=next_lsb)
        else:
            callback = lambda: self._write_complete()
        trigger.trigger_function = callback
        trigger.name = self._group.device.dev_addr_str + 'write_aldb'
        trigger.queue()
        message = self._group.device.create_message('poke_one_byte')
        message.insert_bytes_into_raw({'lsb': lsb_byte})
        self._group.device.queue_device_msg(message)

    def _write_failure(self):
        self._on_failure()

    def _write_complete(self):
        aldb_entry = bytearray([
            self._compiled_record()['link_flags'],
            self._compiled_record()['group'],
            self._compiled_record()['dev_addr_hi'],
            self._compiled_record()['dev_addr_mid'],
            self._compiled_record()['dev_addr_low'],
            self._compiled_record()['data_1'],
            self._compiled_record()['data_2'],
            self._compiled_record()['data_3']
        ])
        record = self._group.device.aldb.get_record(
            self._group.device.aldb.get_aldb_key(
                self.address[0],
                self.address[1]
            )
        )
        record.edit_record(aldb_entry)
        aldb_sequence = SetALDBDelta(group=self._group.device.base_group)
        aldb_sequence.add_success_callback(lambda: self._on_success())
        aldb_sequence.add_failure_callback(lambda: self._on_failure())
        aldb_sequence.start()
