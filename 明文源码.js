import { connect } from 'cloudflare:sockets';

let userID = '';
let proxyIP = '';
let FileName = 'wcx';

export default {
  async fetch(request, env, ctx) {
    try {
      userID = env.UUID || env.uuid || userID;
      proxyIP = env.PROXYIP || env.proxyip || proxyIP;

      if (!userID) {
        return new Response('请设置你的UUID变量', {
          status: 404,
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          }
        });
      }

      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('WebSocket upgrade required', { status: 400 });
      }

      // WebSocket升级逻辑
      const { 0: client, 1: webSocket } = new WebSocketPair();
      webSocket.accept();

      // 处理WebSocket连接
      webSocket.addEventListener('message', async (event) => {
        // 假设这里处理维列斯协议头部
        const chunk = event.data;
        // 简单解析头部逻辑
        const { addressRemote, portRemote } = processVlessHeader(chunk, userID);

        // 假设这是TCP连接
        const tcpSocket = connect({
          hostname: addressRemote,
          port: portRemote,
        });

        // 双向转发数据
        readableWebSocketStream(webSocket).pipeTo(tcpSocket.writable);
        tcpSocket.readable.pipeTo(new WritableStream({
          write(chunk) {
            webSocket.send(chunk);
          },
          close() {
            webSocket.close();
          },
          abort(reason) {
            webSocket.close();
          }
        }));
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    } catch (err) {
      return new Response(err.toString());
    }
  },
};

// 处理维列斯协议头部，这里只是一个简化版
function processVlessHeader(chunk, userID) {
  // 假设这里是头部解析逻辑，实际上这需要更复杂的处理
  return {
    addressRemote: 'example.com', // 这里应该解析出实际的地址
    portRemote: 443, // 这里应该解析出实际的端口
  };
}

function readableWebSocketStream(webSocket) {
  return new ReadableStream({
    start(controller) {
      webSocket.addEventListener('message', event => {
        controller.enqueue(event.data);
      });
      webSocket.addEventListener('close', () => controller.close());
      webSocket.addEventListener('error', err => controller.error(err));
    },
    cancel() {
      webSocket.close();
    }
  });
}
