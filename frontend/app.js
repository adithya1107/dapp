const STATUS = ["Open", "Claimed", "Returned", "Cancelled", "Removed"];
const TYPE = ["Lost", "Found"];

let provider, signer, contract, account;

const $ = (id) => document.getElementById(id);

function showMsg(text, kind = "info") {
  const el = $("message");
  el.textContent = text;
  el.className = "message " + kind;
}

function parseError(e) {
  let msg = e.reason || (e.info && e.info.error && e.info.error.message) || e.shortMessage || e.message || String(e);
  if (e.code === "ACTION_REJECTED") msg = "Transaction rejected in MetaMask";
  return msg;
}

function short(a) { return a.slice(0, 6) + "..." + a.slice(-4); }

async function connectWallet() {
  if (!window.ethereum) {
    showMsg("MetaMask not detected. Please install the MetaMask extension.", "error");
    return;
  }
  if (!ethers.isAddress(CONTRACT_ADDRESS)) {
    showMsg("Set CONTRACT_ADDRESS in config.js first.", "error");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    const net = await provider.getNetwork();
    const bal = await provider.getBalance(account);
    $("walletInfo").textContent = `${short(account)} | ${Number(ethers.formatEther(bal)).toFixed(4)} ETH`;
    $("connectBtn").textContent = "Connected";
    $("network").textContent = `${net.name} (chainId ${net.chainId})`;
    $("contractAddr").textContent = CONTRACT_ADDRESS;
    $("adminAddr").textContent = await contract.owner();
    $("minReward").textContent = ethers.formatEther(await contract.minReward());
    showMsg("Wallet connected.", "success");
    await loadItems();
  } catch (e) {
    showMsg(parseError(e), "error");
  }
}

async function loadItems() {
  if (!contract) return showMsg("Connect your wallet first.", "error");
  try {
    const count = Number(await contract.itemCount());
    $("totalItems").textContent = count;
    const filter = $("filter").value;
    const list = $("items");
    list.innerHTML = "";
    let shown = 0;
    for (let i = count; i >= 1; i--) {
      const it = await contract.getItem(i);
      if (filter !== "all" && Number(it.itemType) !== Number(filter)) continue;
      list.appendChild(renderItem(it));
      shown++;
    }
    if (shown === 0) list.innerHTML = "<p class='small'>No items to show.</p>";
  } catch (e) {
    showMsg(parseError(e), "error");
  }
}

function renderItem(it) {
  const div = document.createElement("div");
  div.className = "item";
  const type = TYPE[Number(it.itemType)];
  const status = STATUS[Number(it.status)];
  const id = Number(it.id);

  const h = document.createElement("h3");
  h.textContent = `#${id} ${it.title}`;
  div.appendChild(h);

  const badges = document.createElement("div");
  badges.innerHTML = `<span class="badge ${type}">${type}</span><span class="badge ${status}">${status}</span>`;
  div.appendChild(badges);

  const lines = [
    `Description: ${it.description || "-"}`,
    `Location: ${it.location}`,
    `Reporter: ${it.reporter}`,
    `Reward in escrow: ${ethers.formatEther(it.reward)} ETH`,
    `Posted: ${new Date(Number(it.timestamp) * 1000).toLocaleString()}`
  ];
  if (it.claimant !== ethers.ZeroAddress) {
    lines.push(`Claimant: ${it.claimant}`);
    lines.push(`Claim note: ${it.claimNote}`);
  }
  const info = document.createElement("div");
  info.className = "small";
  lines.forEach((t) => {
    const row = document.createElement("div");
    row.textContent = t; // textContent prevents XSS from on-chain strings
    info.appendChild(row);
  });
  div.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "actions";
  if (status === "Open") {
    actions.appendChild(btn("Claim", "", () => claim(id)));
    actions.appendChild(btn("Cancel (reporter)", "secondary", () => send("cancelItem", id)));
    actions.appendChild(btn("Remove (admin)", "danger", () => send("removeItem", id)));
  } else if (status === "Claimed") {
    actions.appendChild(btn("Confirm Return (reporter)", "good", () => send("confirmReturn", id)));
    actions.appendChild(btn("Reject Claim (reporter)", "secondary", () => send("rejectClaim", id)));
    actions.appendChild(btn("Remove (admin)", "danger", () => send("removeItem", id)));
  }
  div.appendChild(actions);
  return div;
}

function btn(label, cls, fn) {
  const b = document.createElement("button");
  b.textContent = label;
  if (cls) b.className = cls;
  b.onclick = fn;
  return b;
}

async function runTx(label, txFn) {
  if (!contract) { showMsg("Connect your wallet first.", "error"); return false; }
  try {
    showMsg(`${label}: confirm in MetaMask...`, "info");
    const tx = await txFn();
    showMsg(`${label}: pending... Tx hash: ${tx.hash}`, "info");
    await tx.wait();
    showMsg(`${label}: SUCCESS. Tx hash: ${tx.hash}`, "success");
    await loadItems();
    return true;
  } catch (e) {
    showMsg(`${label}: FAILED - ${parseError(e)}`, "error");
    return false;
  }
}

async function reportItem() {
  const title = $("title").value.trim();
  const description = $("description").value.trim();
  const location = $("location").value.trim();
  const type = Number($("itemType").value);
  const rewardStr = $("reward").value.trim();

  let value = 0n;
  try {
    if (rewardStr) value = ethers.parseEther(rewardStr);
  } catch {
    return showMsg("Invalid reward amount.", "error");
  }
  const ok = await runTx("Report item", () =>
    contract.reportItem(title, description, location, type, { value })
  );
  if (ok) {
    $("title").value = $("description").value = $("location").value = $("reward").value = "";
  }
}

async function claim(id) {
  const note = prompt("Enter a note proving ownership / describing where you found it:");
  if (note === null) return;
  await runTx(`Claim #${id}`, () => contract.claimItem(id, note.trim()));
}

async function send(fn, id) {
  await runTx(`${fn} #${id}`, () => contract[fn](id));
}

$("connectBtn").onclick = connectWallet;
$("reportBtn").onclick = reportItem;
$("refreshBtn").onclick = loadItems;
$("filter").onchange = loadItems;

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());
}
