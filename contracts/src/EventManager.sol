// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Minimal slice of the ENS NameWrapper interface we depend on.
interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function setApprovalForAll(address operator, bool approved) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}

/// @notice Slices of the ENS PublicResolver profiles we write to.
interface IResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function setAddr(bytes32 node, address a) external;
    function setABI(bytes32 node, uint256 contentType, bytes calldata data) external;
}

/// @title EventManager
/// @notice Luma/Meetup-on-ENS. Each event is a subname under `parentNode`; each RSVP is a
///         ticket subname minted under the event node. All event metadata lives in ENS
///         resolver records — no off-chain database.
/// @dev    Iter 2 makes each event self-describing for agents: the event name resolves to
///         this contract's address (addr record) and carries the rsvp ABI (ABI record), so an
///         agent can discover *how* to RSVP purely from ENS. RSVPs are deduped per label.
contract EventManager {
    INameWrapper public immutable wrapper;
    address public immutable resolver;
    bytes32 public immutable parentNode;

    /// @dev Junto moderator: anyone can create events, but the owner can revoke them.
    address public owner;

    struct Event {
        address host;
        uint256 capacity;
        uint256 rsvpCount;
        bool exists;
    }

    /// @dev eventNode (namehash of `<label>.<parent>`) => event data.
    mapping(bytes32 => Event) public events;
    /// @dev ticketNode => already minted (per-label RSVP dedupe).
    mapping(bytes32 => bool) public ticketMinted;

    // ABI record (ENSIP-4 / contentType 1 = JSON): how an agent calls rsvp on this contract.
    uint256 internal constant ABI_JSON = 1;
    bytes internal constant RSVP_ABI =
        "[{\"type\":\"function\",\"name\":\"rsvp\",\"stateMutability\":\"nonpayable\",\"inputs\":[{\"name\":\"eventNode\",\"type\":\"bytes32\"},{\"name\":\"attendeeLabel\",\"type\":\"string\"}],\"outputs\":[{\"name\":\"ticketNode\",\"type\":\"bytes32\"}]}]";

    event EventCreated(bytes32 indexed eventNode, address indexed host, string label, uint256 capacity);
    event RSVP(bytes32 indexed eventNode, bytes32 indexed ticketNode, address indexed attendee, string label);
    event EventRevoked(bytes32 indexed eventNode, address indexed by);
    event OwnershipTransferred(address indexed from, address indexed to);

    error EventNotFound();
    error EventFull();
    error LengthMismatch();
    error AlreadyRSVPed();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(INameWrapper _wrapper, address _resolver, bytes32 _parentNode) {
        wrapper = _wrapper;
        resolver = _resolver;
        parentNode = _parentNode;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Create an event as an ENS subname and write its metadata + self-discovery records.
    /// @dev Permissionless: anyone can host. The deployer must `setApprovalForAll(this, true)` on
    ///      the NameWrapper for the parent so this contract can create subnodes. The event node is
    ///      owned by this contract so it can write records and later mint ticket subnodes under it.
    function createEvent(
        string calldata label,
        uint256 capacity,
        string[] calldata keys,
        string[] calldata values
    ) external returns (bytes32 eventNode) {
        if (keys.length != values.length) revert LengthMismatch();

        eventNode = wrapper.setSubnodeRecord(parentNode, label, address(this), resolver, 0, 0, 0);

        for (uint256 i = 0; i < keys.length; i++) {
            IResolver(resolver).setText(eventNode, keys[i], values[i]);
        }

        // Self-discovery: resolve the event name -> this contract's addr + the rsvp ABI.
        IResolver(resolver).setAddr(eventNode, address(this));
        IResolver(resolver).setABI(eventNode, ABI_JSON, RSVP_ABI);

        events[eventNode] = Event({host: msg.sender, capacity: capacity, rsvpCount: 0, exists: true});

        emit EventCreated(eventNode, msg.sender, label, capacity);
    }

    /// @notice RSVP to an event: mints a ticket subname owned by the attendee with a status record.
    /// @dev Mint to this contract first (so we can write the status record), then transfer the
    ///      ticket to the attendee. capacity == 0 means uncapped; each label can RSVP once.
    function rsvp(bytes32 eventNode, string calldata attendeeLabel) external returns (bytes32 ticketNode) {
        Event storage e = events[eventNode];
        if (!e.exists) revert EventNotFound();
        if (e.capacity != 0 && e.rsvpCount >= e.capacity) revert EventFull();

        ticketNode = wrapper.setSubnodeRecord(eventNode, attendeeLabel, address(this), resolver, 0, 0, 0);
        if (ticketMinted[ticketNode]) revert AlreadyRSVPed();
        ticketMinted[ticketNode] = true;

        IResolver(resolver).setText(ticketNode, "xyz.junto.status", "going");
        wrapper.safeTransferFrom(address(this), msg.sender, uint256(ticketNode), 1, "");

        e.rsvpCount += 1;

        emit RSVP(eventNode, ticketNode, msg.sender, attendeeLabel);
    }

    /// @notice Junto moderation: revoke an event. Marks it closed (blocks further RSVPs) and
    ///         flags the ENS record so the UI drops it. On-chain data can't be erased, so this is
    ///         a soft delete: the subname stays but is clearly marked revoked.
    function revokeEvent(bytes32 eventNode) external onlyOwner {
        Event storage e = events[eventNode];
        if (!e.exists) revert EventNotFound();
        e.exists = false;
        IResolver(resolver).setText(eventNode, "xyz.junto.status", "revoked");
        emit EventRevoked(eventNode, msg.sender);
    }

    /// @notice ERC1155 receiver hook so the NameWrapper can mint tickets to this contract.
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
