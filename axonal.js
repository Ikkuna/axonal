'use strict';
const axon = require('axon');
const push = axon.socket('push');
const pull = axon.socket('pull');
const rep = axon.socket('rep');
const req = axon.socket('req');
const pub = axon.socket('pub')
const sub = axon.socket('sub')
const pub_emitter = axon.socket('pub-emitter');
const sub_emitter = axon.socket('sub-emitter');
const os = require('os');
const util = require("util")
const gateway_ip = process.env.AXONAL_GATEWAY_IP ? process.env.AXONAL_GATEWAY_IP : '172.20.0.2'
const internal_port = 3000
const gateway_port = 4040
var dns = require('dns');

dns.lookup('www.google.com', function onLookup(err, addresses, family) {
  console.log('dns addresses:', addresses);
});

class Axonal {
  constructor(port) {
    this.hostname = process.env.THIS_HOST ? process.env.THIS_HOST : require('os').hostname()
    this.port_env = process.env.AXONAL_GATEWAY_PORT
    console.log('THIS_HOST', this.hostname)
    console.log('AXONAL_GATEWAY_PORT', this.port_env)
    const bindPort = port ? port : internal_port
    push.bind(bindPort);
    pull.on('message', function(msg){
      console.log(JSON.stringify(msg, null, 4));
    });
    
    // this.log('Staging first level')
    pull.connect(bindPort)
  }

  date () { return new Date().toISOString() }
  simple (...msg) { return { date: this.date() , message: msg.join(' ') } }
  register_format (ip) { return { date: this.date(), event:'register', ip: ip } }

  log(...msg) { push.send(this.simple(...msg)) } 
  metadata (data) { data.date = this.date() ; push.send(data) }
  err (...err) { push.send({ Error: err.join(' ') } ) }
  register (ip) { push.send(this.register_format(ip)) }

  decycle(object, replacer) {
      "use strict";

  // Make a deep copy of an object or array, assuring that there is at most
  // one instance of each object or array in the resulting structure. The
  // duplicate references (which might be forming cycles) are replaced with
  // an object of the form

  //      {"$ref": PATH}

  // where the PATH is a JSONPath string that locates the first occurance.

  // So,

  //      var a = [];
  //      a[0] = a;
  //      return JSON.stringify(JSON.decycle(a));

  // produces the string '[{"$ref":"$"}]'.

  // If a replacer function is provided, then it will be called for each value.
  // A replacer function receives a value and returns a replacement value.

  // JSONPath is used to locate the unique object. $ indicates the top level of
  // the object or array. [NUMBER] or [STRING] indicates a child element or
  // property.

      var objects = new WeakMap();     // object to path mappings

      return (function derez(value, path) {

  // The derez function recurses through the object, producing the deep copy.

          var old_path;   // The path of an earlier occurance of value
          var nu;         // The new object or array

  // If a replacer function was provided, then call it to get a replacement value.

          if (replacer !== undefined) {
              value = replacer(value);
          }

  // typeof null === "object", so go on if this value is really an object but not
  // one of the weird builtin objects.

          if (
              typeof value === "object"
              && value !== null
              && !(value instanceof Boolean)
              && !(value instanceof Date)
              && !(value instanceof Number)
              && !(value instanceof RegExp)
              && !(value instanceof String)
          ) {

  // If the value is an object or array, look to see if we have already
  // encountered it. If so, return a {"$ref":PATH} object. This uses an
  // ES6 WeakMap.

              old_path = objects.get(value);
              if (old_path !== undefined) {
                  return {$ref: old_path};
              }

  // Otherwise, accumulate the unique value and its path.

              objects.set(value, path);

  // If it is an array, replicate the array.

              if (Array.isArray(value)) {
                  nu = [];
                  value.forEach(function (element, i) {
                      nu[i] = derez(element, path + "[" + i + "]");
                  });
              } else {

  // If it is an object, replicate the object.

                  nu = {};
                  Object.keys(value).forEach(function (name) {
                      nu[name] = derez(
                          value[name],
                          path + "[" + JSON.stringify(name) + "]"
                      );
                  });
              }
              return nu;
          }
          return value;
      }(object, "$"));
  };

  retrocycle($) {
      "use strict";

  // Restore an object that was reduced by decycle. Members whose values are
  // objects of the form
  //      {$ref: PATH}
  // are replaced with references to the value found by the PATH. This will
  // restore cycles. The object will be mutated.

  // The eval function is used to locate the values described by a PATH. The
  // root object is kept in a $ variable. A regular expression is used to
  // assure that the PATH is extremely well formed. The regexp contains nested
  // * quantifiers. That has been known to have extremely bad performance
  // problems on some browsers for very long strings. A PATH is expected to be
  // reasonably short. A PATH is allowed to belong to a very restricted subset of
  // Goessner's JSONPath.

  // So,
  //      var s = '[{"$ref":"$"}]';
  //      return JSON.retrocycle(JSON.parse(s));
  // produces an array containing a single element which is the array itself.

      var px = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\(?:[\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;

      (function rez(value) {

  // The rez function walks recursively through the object looking for $ref
  // properties. When it finds one that has a value that is a path, then it
  // replaces the $ref object with a reference to the value that is found by
  // the path.

          if (value && typeof value === "object") {
              if (Array.isArray(value)) {
                  value.forEach(function (element, i) {
                      if (typeof element === "object" && element !== null) {
                          var path = element.$ref;
                          if (typeof path === "string" && px.test(path)) {
                              value[i] = eval(path);
                          } else {
                              rez(element);
                          }
                      }
                  });
              } else {
                  Object.keys(value).forEach(function (name) {
                      var item = value[name];
                      if (typeof item === "object" && item !== null) {
                          var path = item.$ref;
                          if (typeof path === "string" && px.test(path)) {
                              value[name] = eval(path);
                          } else {
                              rez(item);
                          }
                      }
                  });
              }
          }
      }($));
      return $;
  };

}

class Gateway extends Axonal {
  constructor(gateway_port, gateway_ip, ip) {
    super(3030)
    this.gateway_ip = gateway_ip
    this.gateway_port = gateway_port
    this.ip = ip
    this.idleTimeout = 60000
    this.connectionRetries = 60
    const subscriberMethods = async function (self) {
      await sub_emitter.bind(self.gateway_port)
      return await sub_emitter
    }
    const publisherMethods = async function (self) {
      await pub_emitter.connect(self.gateway_port, self.gateway_ip)
      return await pub_emitter
    }
    const gatewayMethods = async function(self) {
      const subscriber = await subscriberMethods( self )
      const publisher = await publisherMethods( self )
      return { events: await subscriber, send: await publisher }
    }
    const register_ip = async (self) => {
      // self.log('my ip is',self.ip.address,'with gateway_ip', self.gateway_ip, self.ip.address == self.gateway_ip)
      const endValue = async () => await gatewayMethods( self )
      self.register(self.ip)
      return await endValue().then( x => x )
    }
    this.construction = register_ip(this)
  }

  gatesend(gate) { return (topic,data) => {
      const signature = 'from '+this.hostname
      const emit = this.gate.send.emit
      const address = this.ip.address
      const port = this.gateway_port
      const sender = { id: this.hostname, address: address, port: port } 
      // emit('registry',{ sender: sender , content: 'gateway binded on port '+ port, data:data } )
      return emit(topic,{ sender: sender , content: data })
    } 
  }

  broadcast(topic,...msg) { const construction = this.gate; return this.gatesend(construction)(topic,msg) /*.catch(err => { this.err(err); this.log('[AXONAL]',err) } ) */ }

  idleEvent (interval, msg) {
    const emit = this.gate.send.emit
    const address = this.ip.address
    const sender = { id: this.hostname, address: address } 
    this.log( 'emit connected ? ', emit('idle',{ sender: sender, content: `idle`, message:msg }).connected )
    setInterval(function(){
      emit('idle',{ sender: sender, content: `idle`, message:msg });
    }, interval);
  }

  async followProtocol (retries, callfront) {
    const self = this;
    let count = retries
    var promise1 = new Promise( function(resolve, reject) {
      const iterative = () =>  {
        const y = callfront( 'registry:connected', { connected:'waiting'} )
        setTimeout(function() {
          y.connected == 1 ? 
            (async () => { await callfront( 'registry:connected', { connected:'succesful'} ); return resolve('CONNECTION STARTED') })()
            : 
            count-- < 0 ? 
              reject('Connection exceeded maximum attempts with failure.') 
              : 
              (() => {
                self.log('retry attempt',count);
                iterative()
              })()
          // count-- < 0 ? reject('Connection reached max attempts with failure.') : self.log(count)
          
        }, 5000);
      }
      iterative()
    });
    const check = await promise1.catch( err => self.err(err) );
    return await check
  }

  static async init (port, gateway_ip, callback) {
    const gateway_port = parseInt(port)
    const self = this;
    const ip = await Gateway.self_ip()
    // console.log('ip',ip)
    const build = await new Gateway(parseInt(gateway_port), gateway_ip, ip)
    // console.log('construction', build.construction)
    return await build.construction
        .then( x => {
          const prelog = x
          x.events.on('*', (event, data) => {
            // console.log('Gateway event:', event, data)
            // switch (event) {
            //   case 'registry':

            // }
          })
          x.events.on('registry:*', (event,msg) => { build.metadata({topic:'registry:*', event:event,message:msg}) })
          x.events.on('idle', (msg) => { build.metadata({topic:'idle',message:msg}) } )
          x.events.on('error', (msg) => { build.err(msg); callback ? callback('errors', msg, prelog) : 0 } )
          x.events.on('log', (msg) => { build.metadata({topic:'syslog',message:msg}); callback ? callback('syslog', msg, prelog) : 0 })
          x.events.on('registry:connected', (msg) => {
            // build.log('msg',msg)
            const sender = msg.sender ? msg.sender : null
            const id  = sender.id && sender.address && sender.port ? sender : build.log('not enough information to register')
            // build.log('ips to compare', gateway_ip, sender.address)
            const toconnect = 'tcp://'+sender.address+':'+sender.port
            // build.log('to connect to', toconnect)
            const check = msg.content[0].connected == 'succesful' && gateway_ip != sender.address ? x.send.connect(toconnect) : 1
          })
          build.gate = x; 
          return build 
        } )
        .then( async x => {
          build.log('Gateway sub_emitter binded to', x.hostname,`tcp://${x.ip.address}:${x.gateway_port}`)
          const callfront = (intent, msg) => x.broadcast(intent, msg )
          const reply = await x.followProtocol(12, callfront)
          // callfront( { nextstep: 1 } )
          x.log(x.hostname,x.ip,x.port, reply)
          return x
        })
  }

  static ip_promise () { return util.promisify(require('dns').lookup) }

  static async self_ip () { return await Gateway.ip_promise()(require('os').hostname()) }

}

// rep.connect(3030);

// rep.on('message', function(task, img, reply){
//   switch (task) {
//     case 'resize':
//       // resize the image
//       reply(img);
//       break;
//   }
// });

// setInterval(function(){
//   push.send({ message: 'idle' });
//   // scheme metadata
// }, 1000);
module.exports = { Axonal:Axonal, Gateway:Gateway };