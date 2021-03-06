/* global $ */
var coreJSON = {}

// Ajax response functions

function coreData (data, status, xhr) {
  if (status === 'success') {
    coreJSON = data
    updateModemList(data)
    updateNavigation(data)
    updateModemPage(data)
    updateModemGroupPage(data)
    updateDeviceGroupPage(data)
    if ($('tbody#definedLinks').length) {
      var path = window.location.pathname.replace(/\/$/, '')
      $.getJSON(path + '/links.json', linksData)
    }
  }
}

function linksData (data, status, xhr) {
  if (status === 'success') {
    if ($('tbody#definedLinks').length) {
      generateDefinedLinks(data)
    } // End Defined Links
    if ($('tbody#addLinks').length) {
      $('tbody#addLinks').html('')
      var empty = {}
      empty['empty'] = true
      var row = generateLinkRow(empty)
      row.find('.linkRowButtons').append(`
      <button type="button" class="btn btn-success addLinkButton">
        Add Link
      </button>
      `)
      row.find('select').removeAttr('disabled')
      $('tbody#addLinks').append(row)
      $('.responderInput').change(function () {
        // Update Data Fields when Responder is Changed
        var linkDetails = getDeviceLinkDetails(
          $(this).find(':selected').data('responder_id'),
          $(this).find(':selected').data('responder_group')
        )
        var dataRow = $(this).parents('tr')
        dataRow.find('.linkRowData1').html(
          generateDataSelect(dataRow.data('data_1'), linkDetails['data_1'])
        )
        dataRow.find('.linkRowData2').html(
          generateDataSelect(dataRow.data('data_2'), linkDetails['data_2'])
        )
      })
      $('.addLinkButton').click(function () {
        var row = $(this).parents('tr')
        var jsonData = {
          'responder_id': row.find('.responderInput').find(':selected').data('responder_id'),
          'data_1': parseInt(row.find('.linkRowData1').find(':selected').val()),
          'data_2': parseInt(row.find('.linkRowData2').find(':selected').val()),
          'data_3': parseInt(row.find('.responderInput').find(':selected').data('responder_group'))
        }
        var path = window.location.pathname.replace(/\/$/, '')
        $.ajax({
          url: path + '/links/definedLinks.json',
          method: 'POST',
          data: JSON.stringify(jsonData),
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          success: linksData
        })
      })
    }
    if ($('tbody#undefinedLinks').length) {
      $('tbody#undefinedLinks').html('')
      for (var uid in data['undefinedLinks']) {
        $('tbody#undefinedLinks').append(outputUndefinedLinkRow(uid, data['undefinedLinks'][uid]))
      }
      if ($('tbody#undefinedLinks').is(':empty')) {
        $('#undefinedLinksContainer').hide()
      } else {
        $('#undefinedLinksContainer').show()
      }
      $('.undefinedLinkImport').click(function () {
        var jsonData = {}
        for (var key in $(this).parents('tr').data()) {
          jsonData[key] = $(this).parents('tr').data(key)
        }
        var path = window.location.pathname.replace(/\/$/, '')
        $.ajax({
          url: path + '/links/definedLinks.json',
          method: 'POST',
          data: JSON.stringify(jsonData),
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          success: linksData
        })
      })
      $('.undefinedLinkDelete').click(function () {
        var row = $(this).parents('tr')
        var uid = row.data('uid')
        var path = window.location.pathname.replace(/\/$/, '')
        $.ajax({
          url: path + '/links/undefinedLinks/' + uid + '.json',
          method: 'DELETE',
          dataType: 'json',
          success: linksData
        })
      })
    }
    if ($('tbody#unknownLinks').length) {
      $('tbody#unknownLinks').html('')
      for (var key in data['unknownLinks']) {
        var row = generateLinkRow(data['unknownLinks'][key])
        row.find('.linkRowButtons').append(`
        <button type="button" class="btn btn-default addDevice">
          Add Device
        </button>
        <button type="button" class="btn btn-danger unknownLinkDelete">
          Delete
        </button>
        `)
        row.data('key', key)
        $('tbody#unknownLinks').append(row)
      }
      $('.unknownLinkDelete').click(function () {
        var row = $(this).parents('tr')
        var key = row.data('key')
        var path = window.location.pathname.replace(/\/$/, '')
        $.ajax({
          url: path + '/links/unknownLinks/' + key + '.json',
          method: 'DELETE',
          dataType: 'json',
          success: linksData
        })
      })
      if ($('tbody#unknownLinks').is(':empty')) {
        $('#unknownLinksContainer').hide()
      } else {
        $('#unknownLinksContainer').show()
        registerAddDevice()
      }
    }
  }
}

function generateDefinedLinks (data) {
  $('tbody#definedLinks').html('')
  for (var uid in data['modemLinks']) {
    $('tbody#definedLinks').append(outputModemLinkRow(uid, data['modemLinks'][uid]))
  }
  for (var uid in data['definedLinks']) {
    $('tbody#definedLinks').append(outputDefinedLinkRow(uid, data['definedLinks'][uid]))
  }
  if ($('tbody#definedLinks').is(':empty')) {
    $('#definedLinksContainer').hide()
  } else {
    $('#definedLinksContainer').show()
  }
  $('.definedLinkEdit').click(function () {
    $(this).parents('tr').find('select').removeAttr('disabled')
    $(this).parents('tr').find('.definedLinkEdit').hide()
    $(this).parents('tr').find('.definedLinkFix').hide()
    $(this).parents('tr').find('.definedLinkDelete').hide()
    $(this).parents('tr').find('.definedLinkSave').show()
    $(this).parents('tr').find('.definedLinkCancel').show()
    $(this).parents('tr').removeClass('danger')
  })
  $('.definedLinkCancel').click(function () {
    // Reset data fields back to how they appeared on load
    $(this).parents('tr').find('select').val(function () {
      return $(this).find('option').filter(function () {
        return $(this).prop('defaultSelected')
      }).val()
    })
    $(this).parents('tr').find('select').attr('disabled', true)
    $(this).parents('tr').find('.definedLinkEdit').show()
    $(this).parents('tr').find('.definedLinkDelete').show()
    $(this).parents('tr').find('.definedLinkSave').hide()
    $(this).parents('tr').find('.definedLinkCancel').hide()
    if ($(this).parents('tr').data('status') === 'Broken') {
      $(this).parents('tr').find('.definedLinkFix').show()
      $(this).parents('tr').addClass('warning')
    }
  })
  $('.responderInput').change(function () {
    // Update Data Fields when Responder is Changed
    var linkDetails = getDeviceLinkDetails(
      $(this).find(':selected').data('responder_id'),
      $(this).find(':selected').data('responder_group')
    )
    var dataRow = $(this).parents('tr')
    dataRow.find('.linkRowData1').html(
      generateDataSelect(dataRow.data('data_1'), linkDetails['data_1'])
    )
    dataRow.find('.linkRowData2').html(
      generateDataSelect(dataRow.data('data_2'), linkDetails['data_2'])
    )
  })
  $('.definedLinkSave').click(saveLink)
  $('.definedLinkFix').click(saveLink)
  $('.definedLinkDelete').click(function () {
    var row = $(this).parents('tr')
    var uid = row.data('uid')
    var path = window.location.pathname.replace(/\/$/, '')
    $.ajax({
      url: path + '/links/definedLinks/' + uid + '.json',
      method: 'DELETE',
      dataType: 'json',
      success: linksData
    })
  })
}

function registerAddDevice () {
  $('button.addDevice').click(function () {
    var address = $(this).parents('tr').find('#newDeviceAddress').val()
    var modemAddress = getModemAddress()
    $.ajax({
      url: '/modems/' + modemAddress + '/devices/' + address + '.json',
      method: 'POST',
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
      success: coreData
    })
  })
}

function getDeviceLinkDetails (deviceID, groupID) {
  var ret = {}
  if (coreJSON.hasOwnProperty(deviceID)) {
    ret = coreJSON[deviceID]
    if (ret['groups'].hasOwnProperty(groupID)) {
      ret = ret['groups'][groupID]
    }
  } else {
    for (var modem in coreJSON) {
      if (coreJSON[modem]['devices'].hasOwnProperty(deviceID)) {
        ret = coreJSON[modem]['devices'][deviceID]
        if (ret['groups'].hasOwnProperty(groupID)) {
          ret = ret['groups'][groupID]
        }
        break
      }
    }
  }
  return ret
}

function addResponder (ret, deviceID, group, deviceData) {
  if (deviceData['responder'] === true &&
        (deviceID !== currentDeviceAddress() ||
         group !== parseInt(currentGroup()))
      ) {
    // Key is used solely to catch duplicates
    ret[deviceID + '_' + group] = {
      'name': deviceData['name'],
      'groupNumber': group,
      'deviceID': deviceID
    }
  }
  return ret
}

function getResponderList () {
  var ret = {}
  for (var modem in coreJSON) {
    ret = addResponder(ret, modem, 1, coreJSON[modem])
    for (var modemGroup in coreJSON[modem]['groups']) {
      ret = addResponder(ret, modem, parseInt(modemGroup), coreJSON[modem]['groups'][modemGroup])
    }
    for (var device in coreJSON[modem]['devices']) {
      for (var deviceGroup in coreJSON[modem]['devices'][device]['groups']) {
        ret = addResponder(ret, device, parseInt(deviceGroup), coreJSON[modem]['devices'][device]['groups'][deviceGroup])
      }
    }
  }
  return ret
}

function generateDataSelect (currentValue, dataDetails) {
  var ret = $(`
  <label class="col-md-4 col-form-label label-sm">
    ${dataDetails['name']}
  </label>
  <div class="col-md-8">
    <select class="form-control input-sm"/>
  </div>
  `)
  for (var key in dataDetails['values']) {
    var option = $('<option>').attr('value', dataDetails['values'][key]).text(key)
    if (currentValue === dataDetails['values'][key]) {
      option.attr('selected', true)
    }
    ret.find('select').append(option)
  }
  return ret
}

function generateResponderSelect (responderID) {
  var ret = $('<select class="form-control input-sm responderInput"/>')
  var responders = getResponderList()
  for (var key in responders) {
    var deviceID = responders[key]['deviceID']
    var deviceName = responders[key]['name']
    var groupNumber = responders[key]['groupNumber']
    // var option = $('<option>').attr('value', deviceID).text(deviceName + ' - ' + deviceID)
    var option = $('<option>').text(deviceName + ' - ' + deviceID)
    option.data('responder_id', deviceID)
    option.data('responder_group', groupNumber)
    // This may not be suffcient, we might need to match group here too
    if (responderID === deviceID) {
      option.attr('selected', true)
    }
    ret.append(option)
  }
  return ret
}

function generateLinkRow (data) {
  var ret = $(`
    <tr>
      <th class="row" scope='row'>
      <label class="visible-sm visible-xs col-form-label">
        &nbsp;
      </label>
      </th>
      <td class="row form-group linkRowData1">
      </td>
      <td class="row form-group linkRowData2">
      </td>
      <td class="row linkRowButtons">
        <label class="visible-sm visible-xs col-form-label">
          &nbsp;
        </label>
      </td>
    </tr>
  `)
  if (!('empty' in data) && data['data_1'] !== null) {
    var linkDetails = getDeviceLinkDetails(
      data['responder_id'],
      data['data_3']
    )
    ret.find('th').find('label').after(generateResponderSelect(data['responder_id']))
    ret.find('.linkRowData1').append(generateDataSelect(data['data_1'],
                                          linkDetails['data_1']))
    ret.find('.linkRowData2').append(generateDataSelect(data['data_2'],
                                          linkDetails['data_2']))
  } else if (data['data_1'] === null) {
    var device = data['responder_id']
    if (device === null) {
      device = data['controller_id']
    }
    ret.find('th').find('label').after(`
      ${device}
      <input type='hidden' id='newDeviceAddress' value='${device}'>
    `)
  } else if ('empty' in data) {
    var responders = getResponderList()
    var deviceID = ''
    var groupNumber = 0
    for (var key in responders) {
      deviceID = responders[key]['deviceID']
      groupNumber = responders[key]['groupNumber']
      break
    }
    var linkDetails = getDeviceLinkDetails(
      deviceID,
      groupNumber
    )
    ret.find('th').find('label').after(generateResponderSelect(''))
    var empty = {}
    empty['values'] = {}
    ret.find('.linkRowData1').append(generateDataSelect('', linkDetails['data_1']))
    ret.find('.linkRowData2').append(generateDataSelect('', linkDetails['data_2']))
  }
  ret.find('select').attr('disabled', true)
  for (var key in data) {
    ret.data(key, data[key])
  }
  return ret
}

function outputModemLinkRow (uid, data) {
  var ret = generateLinkRow(data)
  ret.find('.linkRowButtons').append(`
        <button type="button" class="btn btn-warning btn-sm linkFix" style="display: none">
          Fix
        </button>
  `)
  ret.data('uid', uid)
  if (data['status'] === 'notify_modem_link_bad') {
    ret.find('.linkFix').show()
    ret.addClass('warning')
  } else if (data['status'] === 'Working') {
    ret.addClass('info')
  } else if (data['status'] === 'Failed') {
    ret.find('.definedLinkFix').show()
    // need to do something to notify user here?? maybe an alert?
    ret.addClass('warning')
  }
  return ret
}

function outputDefinedLinkRow (uid, data) {
  var ret = generateLinkRow(data)
  ret.find('.linkRowButtons').append(`
        <button type="button" class="btn btn-warning btn-sm definedLinkFix" style="display: none">
          Fix
        </button>
        <button type="button" class="btn btn-default btn-sm definedLinkEdit">
          Edit
        </button>
        <button type="button" class="btn btn-danger btn-sm definedLinkDelete">
          Delete
        </button>
        <button type="button" class="btn btn-success btn-sm definedLinkSave" style="display: none">
          Save
        </button>
        <button type="button" class="btn btn-default btn-sm definedLinkCancel" style="display: none">
          Cancel
        </button>
  `)
  ret.data('uid', uid)
  if (data['status'] === 'Broken') {
    ret.find('.definedLinkFix').show()
    // ret.find('.definedLinkEdit').hide()
    ret.addClass('warning')
  } else if (data['status'] === 'Working') {
    ret.find('.definedLinkEdit').hide()
    ret.find('.definedLinkDelete').hide()
    ret.addClass('info')
  } else if (data['status'] === 'Failed') {
    ret.find('.definedLinkFix').show()
    // need to do something to notify user here?? maybe an alert?
    ret.addClass('warning')
  }
  return ret
}

function outputUndefinedLinkRow (uid, data) {
  var ret = generateLinkRow(data)
  ret.find('.linkRowButtons').append(`
    <button type="button" class="btn btn-default undefinedLinkImport">
      Import
    </button>
    <button type="button" class="btn btn-danger undefinedLinkDelete">
      Delete
    </button>
  `)
  ret.data('uid', uid)
  return ret
}

function saveLink () {
  var row = $(this).parents('tr')
  var uid = row.data('uid')
  var jsonData = {
    'responder_id': row.find('.responderInput').find(':selected').data('responder_id'),
    'data_1': parseInt(row.find('.linkRowData1').find(':selected').val()),
    'data_2': parseInt(row.find('.linkRowData2').find(':selected').val()),
    'data_3': parseInt(row.find('.responderInput').find(':selected').data('responder_group'))
  }
  var path = window.location.pathname.replace(/\/$/, '')
  $.ajax({
    url: path + '/links/definedLinks/' + uid + '.json',
    method: 'PATCH',
    data: JSON.stringify(jsonData),
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    success: linksData
  })
}

function updateModemList (data) {
  if ($('tbody#list_modems').length) {
    $('tbody#list_modems').html('')
    for (var address in data) {
      $('tbody#list_modems').append(`
        <tr>
          <th scope='row'>${data[address]['name']}</th>
          <td>${address}</td>
          <td>status</td>
          <td><a href='/modems/${address}'>View</a></td>
        </tr>
      `)
    }
  }
}

function updateNavigation (data) {
  var modemAddress = getModemAddress()
  if ($('#navModem').length) {
    $('#navModem').html(`${data[modemAddress]['name']} - ${modemAddress}`)
  }
  if ($('a#navModem').length) {
    $('a#navModem').attr('href', '/modems/' + modemAddress)
  }
  if ($('li#navModemGroup').length) {
    var modemGroup = getModemGroup()
    $('li#navModemGroup').html(`${data[modemAddress]['groups'][modemGroup]['name']} - ${modemGroup}`)
  }
  if ($('li#navDeviceGroup').length) {
    var deviceGroup = getDeviceGroup()
    var deviceAddress = getDeviceAddress()
    $('li#navDeviceGroup').html(`${data[modemAddress]['devices'][deviceAddress]['groups'][deviceGroup]['name']} - ${deviceAddress} - ${deviceGroup}`)
  }
}

function updateModemSettings (data) {
  var modemAddress = getModemAddress()
  if ($('form#modemSettings').length) {
    $('form#modemSettings').html('')
    $('form#modemSettings').append(createFormElement(
      'Modem Name', 'name', 'text', data[modemAddress]['name'])
    )
    $('form#modemSettings').append(createFormElement(
      'Modem Address', 'address', 'text', modemAddress, true)
    )
    var hubInputList = [
      ['Hub Username', 'user', 'text', data[modemAddress]['user']],
      ['Hub Password', 'password', 'text', data[modemAddress]['password']],
      ['Hub IP Address', 'ip', 'text', data[modemAddress]['ip']]
    ]
    for (var i = 0; i < hubInputList.length; i++) {
      $('form#modemSettings').append(createFormElement(
        hubInputList[i][0],
        hubInputList[i][1],
        hubInputList[i][2],
        hubInputList[i][3]
      ))
    }
    $('form#modemSettings').append(createFormElement(
      'Modem Port', 'port', 'text', data[modemAddress]['port'])
    )
    $('form#modemSettings').append(`
      <button type="button" id="modemSettingsSubmit" class="btn btn-margin btn-default btn-block">
        Save Settings
      </button>
    `)
    $('#modemSettingsSubmit').click(function () {
      var jsonData = {}
      jsonData[modemAddress] = constructJSON(['name', 'user', 'password', 'ip', 'port'])
      $.ajax({
        url: '/modems.json',
        method: 'PATCH',
        data: JSON.stringify(jsonData),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: [updateModemSettings, updateNavigation]
      })
    })
  }
}

function updateModemPage (data) {
  var modemAddress = getModemAddress()
  updateModemSettings(data)
  if ($('tbody#modemScenes').length) {
    $('tbody#modemScenes').html(``)
    for (var groupNumber in data[modemAddress]['groups']) {
      $('tbody#modemScenes').append(`
        <tr>
          <th scope='row'>${data[modemAddress]['groups'][groupNumber]['name']}</th>
          <td>${groupNumber}</td>
          <td>status</td>
          <td><a href='/modems/${modemAddress}/groups/${groupNumber}'>View</a></td>
        </tr>
      `)
    }
  }
  if ($('tbody#modemDevices').length) {
    $('tbody#modemDevices').html('')
    for (var deviceAddress in data[modemAddress]['devices']) {
      var baseGroup = data[modemAddress]['devices'][deviceAddress]['base_group_number']
      $('tbody#modemDevices').append(`
        <tr>
          <th scope='row'>${data[modemAddress]['devices'][deviceAddress]['groups'][baseGroup]['name']}</th>
          <td>${deviceAddress}</td>
          <td>status</td>
          <td><a href='/modems/${modemAddress}/devices/${deviceAddress}'>View</a></td>
        </tr>
      `)
    }
  }
  registerAddDevice()
}

function updateModemGroupPage (data) {
  var modemAddress = getModemAddress()
  if ($('form#modemGroupSettings').length) {
    var groupNumber = getModemGroup()
    $('form#modemGroupSettings').html('')
    $('form#modemGroupSettings').append(createFormElement(
      'Scene Name', 'name', 'text', data[modemAddress]['groups'][groupNumber]['name'])
    )
    $('form#modemGroupSettings').append(`
      <button type="button" id="modemGroupSettingsSubmit" class="btn btn-margin btn-default btn-block">
        Save Settings
      </button>
    `)
    $('#modemGroupSettingsSubmit').click(function () {
      var jsonData = {}
      jsonData[groupNumber] = constructJSON(['name'])
      $.ajax({
        url: '/modems/' + modemAddress + '/groups.json',
        method: 'PATCH',
        data: JSON.stringify(jsonData),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: [updateModemGroupPage, updateNavigation]
      })
    })
  }
}

function updateDeviceGroupPage (data) {
  var modemAddress = getModemAddress()
  if ($('form#deviceGroupSettings').length) {
    var deviceAddress = getDeviceAddress()
    var deviceGroup = getDeviceGroup()
    $('form#deviceGroupSettings').html('')
    var groupName = data[modemAddress]['devices'][deviceAddress]['groups'][deviceGroup]['name']
    $('form#deviceGroupSettings').append(createFormElement(
      'Group Name', 'name', 'text', groupName)
    )
    $('form#deviceGroupSettings').append(createFormElement(
      'Device Address', 'name', 'text', deviceAddress, true)
    )
    $('form#deviceGroupSettings').append(`
      <button type="button" id="deviceGroupSettingsSubmit" class="btn btn-margin btn-default btn-block">
        Save Settings
      </button>
    `)
    $('#deviceGroupSettingsSubmit').click(function () {
      var jsonData = {}
      jsonData[deviceGroup] = constructJSON(['name'])
      $.ajax({
        url: '/modems/' + modemAddress + '/devices/' + deviceAddress + '/groups.json',
        method: 'PATCH',
        data: JSON.stringify(jsonData),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: [updateModemGroupPage, updateNavigation]
      })
    })
    $('.deleteDevice').click(function () {
      $.ajax({
        url: '/modems/' + modemAddress + '/devices/' + deviceAddress + '.json',
        method: 'DELETE',
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: navigateToModem
      })
    })
  }
  if ($('tbody#deviceGroups').length) {
    $('tbody#deviceGroups').html(``)
    for (var groupNumber in data[modemAddress]['devices'][deviceAddress]['groups']) {
      $('tbody#deviceGroups').append(`
        <tr>
          <th scope='row'>${data[modemAddress]['devices'][deviceAddress]['groups'][groupNumber]['name']}</th>
          <td>${groupNumber}</td>
          <td>status</td>
          <td><a href='/modems/${modemAddress}/devices/${deviceAddress}/groups/${groupNumber}'>View</a></td>
        </tr>
      `)
    }
  }
}

function navigateToModem (data, status, xhr) {
  var modemAddress = getModemAddress()
  window.location.replace('/modems/' + modemAddress)
}

function createFormElement (label, id, type, value, readOnly) {
  var labelElement = $('<label></label>')
  labelElement.html(label)
  labelElement.attr('for', id)
  var inputElement = $('<input class="form-control"></input>')
  inputElement.prop('type', type)
  inputElement.attr('id', id)
  inputElement.attr('name', id)
  inputElement.attr('value', value)
  if (readOnly) {
    inputElement.attr('readonly', true)
  }
  var divElement = $('<div></div>')
  divElement.append(labelElement, inputElement)
  return divElement.html()
}

function constructJSON (list) {
  var ret = {}
  for (var i = 0; i < list.length; i++) {
    ret[list[i]] = $('input#' + list[i]).val()
  }
  return ret
}

function pathParse (regex) {
  var result = regex.exec(window.location.pathname)
  var ret = null
  if (result !== null) {
    ret = regex.exec(window.location.pathname)[1]
  }
  return ret
}

function getModemAddress () {
  var regex = /^\/modems\/([A-Fa-f0-9]{6})/
  return pathParse(regex)
}

function getModemGroup () {
  var regex = /^\/modems\/[A-Fa-f0-9]{6}\/groups\/([0-9]{1,3})/
  return pathParse(regex)
}

function getDeviceAddress () {
  var regex = /^\/modems\/[A-Fa-f0-9]{6}\/devices\/([A-Fa-f0-9]{6})/
  return pathParse(regex)
}

function getDeviceGroup () {
  var regex = /^\/modems\/[A-Fa-f0-9]{6}\/devices\/[A-Fa-f0-9]{6}\/groups\/([0-9]{1,3})/
  return pathParse(regex)
}

function currentDeviceAddress () {
  var ret = getDeviceAddress()
  if (ret === null) {
    ret = getModemAddress()
  }
  return ret
}

function currentGroup () {
  var ret = getDeviceGroup()
  if (ret === null) {
    ret = getModemGroup()
  }
  return ret
}

$(document).ready(function () {
  $.getJSON('/modems.json', coreData)
})
