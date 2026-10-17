// >>> After deploying in Remix, paste your deployed contract address below <<<
const CONTRACT_ADDRESS = "0x851660b2f578D982B375f84c0Ca2CFD8F3A9b8eF";

const CONTRACT_ABI = [
  "constructor(uint256 _minReward)",
  "function owner() view returns (address)",
  "function itemCount() view returns (uint256)",
  "function minReward() view returns (uint256)",
  "function reportItem(string _title, string _description, string _location, uint8 _type) payable",
  "function claimItem(uint256 _id, string _note)",
  "function confirmReturn(uint256 _id)",
  "function rejectClaim(uint256 _id)",
  "function cancelItem(uint256 _id)",
  "function removeItem(uint256 _id)",
  "function getItem(uint256 _id) view returns (tuple(uint256 id, address reporter, string title, string description, string location, uint8 itemType, uint8 status, address claimant, string claimNote, uint256 reward, uint256 timestamp))",
  "event ItemReported(uint256 indexed id, address indexed reporter, uint8 itemType, string title, uint256 reward)",
  "event ItemClaimed(uint256 indexed id, address indexed claimant, string note)",
  "event ClaimRejected(uint256 indexed id, address indexed claimant)",
  "event ItemReturned(uint256 indexed id, address indexed claimant, uint256 rewardPaid)",
  "event ItemCancelled(uint256 indexed id)",
  "event ItemRemoved(uint256 indexed id, address indexed byAdmin)"
];
