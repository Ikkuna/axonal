# axonal

Axonal is a message broker for internal cluster communication between containers and microservices. Built over axon library, it's principles is to be simple, small, fast and easy to use, in contexts where promised based communications is the common ground.

  Axonal:
    @port

    constructor:
        push.bind(@port)                : bind axon to @port
        pull.on('message', cb)          : binds cb for every incoming message
        pull.connect(@port)             : connects to itself for internal messaging
        .hostname                       : hostname in the local network
        .port_env                       : AXONAL_GATEWAY_PORT environment variable

    methods:
        date ()                         : returns locate date in ISOString.
        simple                          : returns an object with date and message from joined spread of the input.
        register_format                 : returns an object with date, event type register and ip from input.
        log                             : contructs and send a simple string message.
        metadata                        : constructs and send a json message with date.
        err                             : sends an Error message json object.
        register                        : sends a register_format message.
        decycle                         : reconstructs object replacing loops with references.
        retrocycle                      : reconstruct object loops from loop references.

  Gateway extends Axonal:
    @gateway_port
    @gateway_ip
    @ip

    constructor:
        super(3030)                     : inherits Axonal with @port=3030
        subscriberMethods(self)         : binds subscription to self.gateway_port
        publisherMethods(self)          : connects publishers to "self.gateway_ip:self.gateway_port"
        gatewayMethods(self)            : compose subscriber and publisher methods from one call and "self".
        register_ip(self)               : send register message and awaits gatewayMethods async call. returns subcriber and publisher instances { events: subscriber, send: publisher }
        .gateway_ip                     : inherits gateway_ip variable from input.
        .gateway_port                   : inherits gateway_port variable from input.
        .ip                             : inherits ip variable from input.
        .idleTimeout                    : timeout for idle events variable.
        .connectionRetries              : connection retries variable.
        .construction                   : calls and receives register_ip(this) returned value. binds "this".
    methods:
        gatesend                        : returns a function for data emition to topics, with sender information included.
        broadcast                       : sends a message to a specific topic.
        idleEvent                       : send messages every specific timeout.
        followProtocol                  : protocol of retries and callback for gateway connection.
        static init                     : static method for service initialization. binds self information and opens topic for [registry:*, idle, error, log, registry:connected]. logs out the state of the connection and returns a promise for further execution in the pipeline (opens the pipeline).
        static ip_promise               : returns a promisify of dns lookup.
        static self_ip                  : looks up self hostname.
