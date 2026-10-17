// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Lost & Found Board
/// @notice Decentralized notice board where users report lost/found items,
///         claim them, and optionally attach an ETH reward held in escrow.
contract LostFoundBoard {
    enum ItemType { Lost, Found }
    enum Status { Open, Claimed, Returned, Cancelled, Removed }

    struct Item {
        uint256 id;
        address reporter;
        string title;
        string description;
        string location;
        ItemType itemType;
        Status status;
        address claimant;
        string claimNote;
        uint256 reward;      // wei held in escrow (Lost items only)
        uint256 timestamp;
    }

    address public owner;       // admin / moderator
    uint256 public itemCount;
    uint256 public minReward;   // minimum reward (wei) if a reward is attached

    mapping(uint256 => Item) private items;

    event ItemReported(uint256 indexed id, address indexed reporter, ItemType itemType, string title, uint256 reward);
    event ItemClaimed(uint256 indexed id, address indexed claimant, string note);
    event ClaimRejected(uint256 indexed id, address indexed claimant);
    event ItemReturned(uint256 indexed id, address indexed claimant, uint256 rewardPaid);
    event ItemCancelled(uint256 indexed id);
    event ItemRemoved(uint256 indexed id, address indexed byAdmin);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only admin can do this");
        _;
    }

    modifier validId(uint256 _id) {
        require(_id > 0 && _id <= itemCount, "Item does not exist");
        _;
    }

    modifier onlyReporter(uint256 _id) {
        require(msg.sender == items[_id].reporter, "Only the reporter can do this");
        _;
    }

    constructor(uint256 _minReward) {
        owner = msg.sender;
        minReward = _minReward;
    }

    /// @notice Post a lost or found item. Reward (msg.value) allowed only for Lost items.
    function reportItem(
        string calldata _title,
        string calldata _description,
        string calldata _location,
        ItemType _type
    ) external payable {
        require(bytes(_title).length > 0 && bytes(_title).length <= 80, "Title must be 1-80 chars");
        require(bytes(_description).length <= 300, "Description max 300 chars");
        require(bytes(_location).length > 0 && bytes(_location).length <= 100, "Location must be 1-100 chars");

        if (msg.value > 0) {
            require(_type == ItemType.Lost, "Reward allowed only for Lost items");
            require(msg.value >= minReward, "Reward below minimum");
        }

        itemCount++;
        Item storage it = items[itemCount];
        it.id = itemCount;
        it.reporter = msg.sender;
        it.title = _title;
        it.description = _description;
        it.location = _location;
        it.itemType = _type;
        it.status = Status.Open;
        it.reward = msg.value;
        it.timestamp = block.timestamp;

        emit ItemReported(itemCount, msg.sender, _type, _title, msg.value);
    }

    /// @notice Claim an open item (finder of a Lost item / owner of a Found item).
    function claimItem(uint256 _id, string calldata _note) external validId(_id) {
        Item storage it = items[_id];
        require(it.status == Status.Open, "Item is not open");
        require(msg.sender != it.reporter, "Reporter cannot claim own item");
        require(bytes(_note).length > 0 && bytes(_note).length <= 200, "Note must be 1-200 chars");

        it.status = Status.Claimed;
        it.claimant = msg.sender;
        it.claimNote = _note;

        emit ItemClaimed(_id, msg.sender, _note);
    }

    /// @notice Reporter confirms the item was returned; escrowed reward goes to claimant.
    function confirmReturn(uint256 _id) external validId(_id) onlyReporter(_id) {
        Item storage it = items[_id];
        require(it.status == Status.Claimed, "No pending claim");

        uint256 amount = it.reward;
        address payable to = payable(it.claimant);
        it.status = Status.Returned;
        it.reward = 0;

        if (amount > 0) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "Reward transfer failed");
        }
        emit ItemReturned(_id, to, amount);
    }

    /// @notice Reporter rejects a claim; the item becomes Open again.
    function rejectClaim(uint256 _id) external validId(_id) onlyReporter(_id) {
        Item storage it = items[_id];
        require(it.status == Status.Claimed, "No pending claim");

        address rejected = it.claimant;
        it.status = Status.Open;
        it.claimant = address(0);
        it.claimNote = "";

        emit ClaimRejected(_id, rejected);
    }

    /// @notice Reporter cancels an open post; reward refunded.
    function cancelItem(uint256 _id) external validId(_id) onlyReporter(_id) {
        Item storage it = items[_id];
        require(it.status == Status.Open, "Only open items can be cancelled");

        uint256 amount = it.reward;
        it.status = Status.Cancelled;
        it.reward = 0;

        if (amount > 0) {
            (bool ok, ) = payable(it.reporter).call{value: amount}("");
            require(ok, "Refund failed");
        }
        emit ItemCancelled(_id);
    }

    /// @notice Admin removes spam/abusive posts; reward refunded to reporter.
    function removeItem(uint256 _id) external validId(_id) onlyOwner {
        Item storage it = items[_id];
        require(it.status == Status.Open || it.status == Status.Claimed, "Item already closed");

        uint256 amount = it.reward;
        it.status = Status.Removed;
        it.reward = 0;

        if (amount > 0) {
            (bool ok, ) = payable(it.reporter).call{value: amount}("");
            require(ok, "Refund failed");
        }
        emit ItemRemoved(_id, msg.sender);
    }

    /// @notice Read one item.
    function getItem(uint256 _id) external view validId(_id) returns (Item memory) {
        return items[_id];
    }
}
