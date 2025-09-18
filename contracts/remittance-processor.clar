(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-INVALID-RECIPIENT u103)
(define-constant ERR-TRANSFER-ALREADY-CONFIRMED u104)
(define-constant ERR-TRANSFER-NOT-FOUND u105)
(define-constant ERR-COMPLIANCE-FAILED u106)
(define-constant ERR-FEE-CALCULATION-FAILED u107)
(define-constant ERR-ESCROW-LOCK-FAILED u108)
(define-constant ERR-TIMEOUT-EXCEEDED u109)
(define-constant ERR-INVALID-STABLECOIN u110)
(define-constant ERR-INVALID-TRANSFER-ID u111)
(define-constant ERR-CANCEL-NOT-ALLOWED u112)
(define-constant ERR-ORACLE-PRICE-FAILED u113)

(define-data-var next-transfer-id uint u0)
(define-data-var default-timeout uint u144) ;; 24 hours in blocks
(define-data-var fee-percentage uint u50) ;; 0.5%
(define-data-var authority-contract (optional principal) none)

(define-map transfers
  uint
  {
    sender: principal,
    recipient: principal,
    amount: uint,
    stablecoin: (string-utf8 10),
    status: (string-utf8 20),
    timestamp: uint,
    fee: uint,
    timeout: uint
  }
)

(define-map sender-balances
  principal
  uint
)

(define-map recipient-balances
  principal
  uint
)

(define-read-only (get-transfer (id uint))
  (map-get? transfers id)
)

(define-read-only (get-sender-balance (sender principal))
  (default-to u0 (map-get? sender-balances sender))
)

(define-read-only (get-recipient-balance (recipient principal))
  (default-to u0 (map-get? recipient-balances recipient))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-AMOUNT))
)

(define-private (validate-recipient (recipient principal))
  (if (is-principal recipient)
      (ok true)
      (err ERR-INVALID-RECIPIENT))
)

(define-private (validate-stablecoin (coin (string-utf8 10)))
  (if (or (is-eq coin "USDC") (is-eq coin "USDT") (is-eq coin "DAI"))
      (ok true)
      (err ERR-INVALID-STABLECOIN))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (calculate-fee (amount uint))
  (let ((fee (* amount (var-get fee-percentage)) (/ u10000)))
    (if (> fee u0)
        (ok fee)
        (err ERR-FEE-CALCULATION-FAILED))
  )
)

(define-private (check-compliance (sender principal))
  (ok true) ;; Mock compliance check
)

(define-private (lock-in-escrow (id uint) (amount uint) (fee uint))
  (begin
    (map-set transfers id
      (unwrap! (map-get? transfers id)
        {
          sender: (get sender (unwrap! (map-get? transfers id) {})),
          recipient: (get recipient (unwrap! (map-get? transfers id) {})),
          amount: amount,
          stablecoin: (get stablecoin (unwrap! (map-get? transfers id) {})),
          status: "locked",
          timestamp: (get timestamp (unwrap! (map-get? transfers id) {})),
          fee: fee,
          timeout: (+ (get timestamp (unwrap! (map-get? transfers id) {})) (var-get default-timeout))
        }
      )
    )
    (ok true)
  )
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-default-timeout (new-timeout uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-timeout u0) (err ERR-INVALID-AMOUNT))
    (var-set default-timeout new-timeout)
    (ok true)
  )
)

(define-public (set-fee-percentage (new-percentage uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= new-percentage u1000) (err ERR-INVALID-AMOUNT)) ;; Max 10%
    (var-set fee-percentage new-percentage)
    (ok true)
  )
)

(define-public (deposit-balance (amount uint))
  (begin
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((current (get-sender-balance tx-sender)))
      (map-set sender-balances tx-sender (+ current amount))
      (print { event: "balance-deposited", sender: tx-sender, amount: amount })
      (ok true)
    )
  )
)

(define-public (initiate-transfer
  (recipient principal)
  (amount uint)
  (stablecoin (string-utf8 10))
)
  (let (
        (next-id (var-get next-transfer-id))
        (authority (var-get authority-contract))
        (current-balance (get-sender-balance tx-sender))
      )
    (asserts! (is-some authority) (err ERR-NOT-AUTHORIZED))
    (try! (validate-amount amount))
    (try! (validate-recipient recipient))
    (try! (validate-stablecoin stablecoin))
    (asserts! (>= current-balance (+ amount (try! (calculate-fee amount)))) (err ERR-INSUFFICIENT-BALANCE))
    (try! (check-compliance tx-sender))
    (let ((fee (try! (calculate-fee amount))))
      (map-set transfers next-id
        {
          sender: tx-sender,
          recipient: recipient,
          amount: amount,
          stablecoin: stablecoin,
          status: "initiated",
          timestamp: block-height,
          fee: fee,
          timeout: (+ block-height (var-get default-timeout))
        }
      )
      (map-set sender-balances tx-sender (- current-balance (+ amount fee)))
      (try! (lock-in-escrow next-id amount fee))
      (var-set next-transfer-id (+ next-id u1))
      (print { event: "transfer-initiated", id: next-id })
      (ok next-id)
    )
  )
)

(define-public (confirm-transfer (id uint))
  (let ((transfer (map-get? transfers id)))
    (match transfer
      t
        (begin
          (asserts! (is-eq (get recipient t) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (is-eq (get status t) "locked") (err ERR-TRANSFER-ALREADY-CONFIRMED))
          (asserts! (<= (get timeout t) block-height) (err ERR-TIMEOUT-EXCEEDED))
          (map-set transfers id
            {
              sender: (get sender t),
              recipient: (get recipient t),
              amount: (get amount t),
              stablecoin: (get stablecoin t),
              status: "confirmed",
              timestamp: (get timestamp t),
              fee: (get fee t),
              timeout: (get timeout t)
            }
          )
          (let ((current (get-recipient-balance tx-sender)))
            (map-set recipient-balances tx-sender (+ current (get amount t)))
          )
          (print { event: "transfer-confirmed", id: id })
          (ok true)
        )
      (err ERR-TRANSFER-NOT-FOUND)
    )
  )
)

(define-public (cancel-transfer (id uint))
  (let ((transfer (map-get? transfers id)))
    (match transfer
      t
        (begin
          (asserts! (is-eq (get sender t) tx-sender) (err ERR-NOT-AUTHORIZED))
          (asserts! (or (is-eq (get status t) "initiated") (is-eq (get status t) "locked")) (err ERR-CANCEL-NOT-ALLOWED))
          (asserts! (> (get timeout t) block-height) (err ERR-TIMEOUT-EXCEEDED))
          (map-set transfers id
            {
              sender: (get sender t),
              recipient: (get recipient t),
              amount: (get amount t),
              stablecoin: (get stablecoin t),
              status: "cancelled",
              timestamp: (get timestamp t),
              fee: (get fee t),
              timeout: (get timeout t)
            }
          )
          (let ((current (get-sender-balance tx-sender)))
            (map-set sender-balances tx-sender (+ current (- (get amount t) (get fee t))))
          )
          (print { event: "transfer-cancelled", id: id })
          (ok true)
        )
      (err ERR-TRANSFER-NOT-FOUND)
    )
  )
)

(define-read-only (get-transfer-count)
  (var-get next-transfer-id)
)