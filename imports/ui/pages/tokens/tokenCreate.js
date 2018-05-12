import './tokenCreate.html'
/* global LocalStore */
/* global selectedNode */
/* global XMSS_OBJECT */
/* global findNodeData */
/* global DEFAULT_NODES */
/* global SHOR_PER_QUANTA */

let countRecipientsForValidation = 1

function createTokenTxn() {
  // Get to/amount details
  const sendFrom = addressForAPI(LocalStore.get('transferFromAddress'))
  const owner = addressForAPI(document.getElementById('owner').value)
  const symbol = document.getElementById('symbol').value
  const name = document.getElementById('name').value
  const decimals = document.getElementById('decimals').value
  const txnFee = document.getElementById('fee').value
  const otsKey = document.getElementById('otsKey').value

  let tokenHolders = []

  // Convert strings to bytes
  const pubKey = hexToBytes(XMSS_OBJECT.getPK())
  const symbolBytes = stringToBytes(symbol)
  const nameBytes = stringToBytes(name)

  // Collect Token Holders and create payload
  var initialBalancesAddress = document.getElementsByName("initialBalancesAddress[]")
  var initialBalancesAddressAmount = document.getElementsByName("initialBalancesAddressAmount[]")
  
  for (var i = 0; i < initialBalancesAddress.length; i++) {
    const thisHolder = {
      address: addressForAPI(initialBalancesAddress[i].value),
      amount: initialBalancesAddressAmount[i].value * Math.pow(10, decimals)
    }

    tokenHolders.push(thisHolder)
  }

  // Construct request
  const grpcEndpoint = findNodeData(DEFAULT_NODES, selectedNode()).grpc
  const request = {
    addressFrom: sendFrom,
    owner: owner,
    symbol: symbolBytes,
    name: nameBytes,
    decimals: decimals,
    initialBalances: tokenHolders,
    fee: txnFee * SHOR_PER_QUANTA,
    xmssPk: pubKey,
    grpc: grpcEndpoint,
  }

  Meteor.call('createTokenTxn', request, (err, res) => {
    if (err) {
      LocalStore.set('tokenCreationError', err)
      $('#tokenCreationFailed').show()
      $('#tokenCreateForm').hide()
    } else {
      const confirmation = {
        hash: res.txnHash,
        from: binaryToQrlAddress(res.response.extended_transaction_unsigned.addr_from),
        symbol: bytesToString(res.response.extended_transaction_unsigned.tx.token.symbol),
        name: bytesToString(res.response.extended_transaction_unsigned.tx.token.name),
        owner: binaryToQrlAddress(res.response.extended_transaction_unsigned.tx.token.owner),
        decimals: res.response.extended_transaction_unsigned.tx.token.decimals,
        fee: res.response.extended_transaction_unsigned.tx.fee / SHOR_PER_QUANTA,
        initialBalances: res.response.extended_transaction_unsigned.tx.token.initial_balances,
        otsKey: otsKey,
      }

      LocalStore.set('tokenCreationConfirmation', confirmation)
      LocalStore.set('tokenCreationConfirmationResponse', res.response)

      // Send to confirm page.
      const params = { }
      const path = FlowRouter.path('/tokens/create/confirm', params)
      FlowRouter.go(path)
    }
  })
}

// Function to initialise form validation
function initialiseFormValidation() {
  let validationRules = {}

  // Calculate validation fields based on countRecipientsForValidation for to/amount fields
  for(let i = 1; i <= countRecipientsForValidation; i++) {
     validationRules['initialBalancesAddress' + i] = {
      identifier: 'initialBalancesAddress_'+i,
      rules: [
        {
          type: 'empty',
          prompt: 'Please enter the QRL address you wish to allocate funds to',
        },
        {
          type: 'exactLength[79]',
          prompt: 'QRL address must be exactly 79 characters',
        },
      ],
    };

    validationRules['initialBalancesAddressAmount' + i] = {
      identifier: 'initialBalancesAddressAmount_'+i,
      rules: [
        {
          type: 'empty',
          prompt: 'You must enter an amount to allocate',
        },
        {
          type: 'number',
          prompt: 'Amount must be a number',
        },
      ],
    }
  }

  // Validate token details
  validationRules['owner'] = {
    id: 'owner',
    rules: [
      {
        type: 'empty',
        prompt: 'Please enter the QRL address you wish to make the owner of this token',
      },
      {
        type: 'exactLength[79]',
        prompt: 'QRL address must be exactly 79 characters',
      },
    ],
  }
  validationRules['symbol'] = {
    id: 'symbol',
    rules: [
      {
        type: 'empty',
        prompt: 'You must enter a token symbol',
      },
    ],
  }
  validationRules['name'] = {
    id: 'name',
    rules: [
      {
        type: 'empty',
        prompt: 'You must enter a token name',
      },
    ],
  }
  validationRules['decimals'] = {
    id: 'decimals',
    rules: [
      {
        type: 'empty',
        prompt: 'You must enter how many decimals this token should have',
      },
      {
        type: 'number',
        prompt: 'Decimals must be a number',
      },
    ],
  }


  // Now set fee and otskey validation rules
  validationRules['fee'] = {
    id: 'fee',
    rules: [
      {
        type: 'empty',
        prompt: 'You must enter a fee',
      },
      {
        type: 'number',
        prompt: 'Fee must be a number',
      },
    ],
  }
  validationRules['otsKey'] = {
    id: 'otsKey',
    rules: [
      {
        type: 'empty',
        prompt: 'You must enter an OTS Key Index',
      },
      {
        type: 'number',
        prompt: 'OTS Key Index must be a number',
      },
    ],
  }

  // Initliase the form validation
  $('.ui.form').form({
    fields: validationRules,
  })
}

Template.appTokenCreate.onRendered(() => {
  // Initialise dropdowns
  $('.ui.dropdown').dropdown()

  // Set default transfer recipients to 1
  countRecipientsForValidation = 1
  
  // Initialise Form Validation
  initialiseFormValidation()

  // Get wallet balance
  getBalance(getXMSSDetails().address, function() {
    // Show warning is otsKeysRemaining is low
    if(LocalStore.get('otsKeysRemaining') < 50) {
      // Shown low OTS Key warning modal
      $('#lowOtsKeyWarning').modal('transition', 'disable').modal('show')
    }
  })
})

Template.appTokenCreate.events({
  'click #addTokenHolder': (event) => {
    event.preventDefault()
    event.stopPropagation()

    // Increment count of recipients
    countRecipientsForValidation += 1

    const newTokenHolderHtml = `
      <div class="field">
        <label>Holder Balance</label>
        <div class="three fields">
          <div class="ten wide field">
            <input type="text" id="initialBalancesAddress_${countRecipientsForValidation}" name="initialBalancesAddress[]" placeholder="Token Holder QRL Address">
          </div>
          <div class="five wide field">
            <input type="text" id="initialBalancesAddressAmount_${countRecipientsForValidation}" name="initialBalancesAddressAmount[]" placeholder="Token Balance">
          </div>
          <div class="one wide field">
            <button class="ui red button removeTokenHolder"><i class="remove user icon"></i></button>
          </div>
        </div>
      </div>
    `;

    // Append newTokenHolderHtml to tokenHolders div
    $('#tokenHolders').append(newTokenHolderHtml)

    // Initialise Form Validation
    initialiseFormValidation()
  },
  'click .removeTokenHolder': (event) => {
    event.preventDefault()
    event.stopPropagation()

    // Subtract one recipient for validation
    countRecipientsForValidation -= 1

    // Remove the token holder
    $(event.currentTarget).parent().parent().parent().remove()

    // Initialise Form Validation
    initialiseFormValidation()
  },
  'submit #generateTokenForm': (event) => {
    event.preventDefault()
    event.stopPropagation()
    $('#generating').show()

    setTimeout(() => { createTokenTxn() }, 200)
  },
})

Template.appTokenCreate.helpers({
  transferFrom() {
    const transferFrom = {}
    transferFrom.balance = LocalStore.get('transferFromBalance')
    transferFrom.address = LocalStore.get('transferFromAddress')
    return transferFrom
  },
  transactionConfirmation() {
    const confirmation = LocalStore.get('transactionConfirmation')
    return confirmation
  },
  transactionConfirmationAmount() {
    const confirmationAmount = LocalStore.get('transactionConfirmationAmount')
    return confirmationAmount
  },
  transactionConfirmationFee() {
    const transactionConfirmationFee = LocalStore.get('transactionConfirmationFee')
    return transactionConfirmationFee
  },
  transactionGenerationError() {
    const error = LocalStore.get('transactionGenerationError')
    return error
  },
  otsKeyEstimate() {
    const otsKeyEstimate = LocalStore.get('otsKeyEstimate')
    return otsKeyEstimate
  },
  otsKeysRemaining() {
    const otsKeysRemaining = LocalStore.get('otsKeysRemaining')
    return otsKeysRemaining
  },
  nodeExplorerUrl() {
    if ((LocalStore.get('nodeExplorerUrl') === '') || (LocalStore.get('nodeExplorerUrl') === null)) {
      return DEFAULT_NODES[0].explorerUrl
    }
    return LocalStore.get('nodeExplorerUrl')
  },
})
