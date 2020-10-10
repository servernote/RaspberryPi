//BLE Peripheral sample characteristic

var Bleno = require( 'bleno' );
var Util = require( 'util' );
var Fs = require( 'fs' );
var Request = require('request');
var BlenoCharacteristic = Bleno.Characteristic;

var CharacteristicUUID = '30a5f1bb-61dc-45f0-9c52-2218d080fa77';

var MaxValueSize;
var PushCallback;

var RecvCode;
var RecvData;
var RecvSize;
var RecvRead;

var ReplyArray;
var ReplyData;
var ReplySize;
var ReplyRead;

var MyCharacteristic = function() {
	console.log( 'MyCharacteristic - constructor' );

	MyCharacteristic.super_.call( this,
	{
		uuid: CharacteristicUUID,
		properties: ['read', 'write', 'notify'],
		value: null
	} );

	this._value = null;
	this._updateValueCallback = null;
	this.clientAddress = null;
};

Util.inherits( MyCharacteristic,BlenoCharacteristic );

MyCharacteristic.prototype.onSubscribe = function( maxValueSize,updateValueCallback )
{
	MaxValueSize = maxValueSize;
	console.log( 'MyCharacteristic - onSubscribe maxValueSize = ' + MaxValueSize );
	this._updateValueCallback = updateValueCallback;
	PushCallback = updateValueCallback;
	RecvCode = null;
	RecvData = null;
	RecvSize = 0;
	RecvRead = 0;
	ReplyArray = [];
	ReplyData = null;
	ReplySize = 0;
	ReplyRead = 0;
};

MyCharacteristic.prototype.onUnsubscribe = function()
{ console.log( 'MyCharacteristic - onUnsubscribe' );
	MaxValueSize = 0;
	this._updateValueCallback = null;
	PushCallback = null;
	RecvCode = null;
	RecvData = null;
	RecvSize = 0;
	RecvRead = 0;
	ReplyArray = [];
	ReplyData = null;
	ReplySize = 0;
	ReplyRead = 0;
};

// Stream Data Format
// CODE(1byte text) + BODYSIZE(7byte zero filled text) + BODYDATA
// CODE is
// N=Notify only(empty body),
// T=Simple Text Data
// U=URL Text Data
// I=Image Binary Data

MyCharacteristic.prototype.onWriteRequest = function( data,offset,withoutResponse,callback )
{ console.log( 'MyCharacteristic - onWriteRequest length=' + data.length + ",offset=" + offset + ",withoutResponse=" + withoutResponse );

	var index = 0;
	var remain = data.length;
	while( remain > 0 ){
		if( RecvCode == null ){ //ヘッダー
			if( remain < 8 ){
				console.log( 'remain data less than 8 bytes' );
				break; //fatal
			}
			var head = data.slice( index,index + 8 );
			var code = data.slice( index,index + 1 ) + '';
			index++; remain--;
			console.log( 'code is ' + code );
			if( code != 'N' && code != 'T' && code != 'U' && code != 'I' ){
				console.log( 'invalid code' );
				break; //fatal
			}
			RecvCode = code;
			var bytestr = data.slice( index,index + 7 );
			console.log( 'content size str ' + bytestr );
			RecvSize = Number( bytestr );
			console.log( 'content size int ' + RecvSize );
			index += 7; remain -= 7;
			RecvRead = 0;
			RecvData = [];
			continue;
		}
		//ボディ
		var copysize;
		if( RecvRead + remain > RecvSize ){
			copysize = RecvSize - RecvRead;
		}
		else{
			copysize = remain;
		}
		console.log( 'copy data size is ' + copysize );
		var copydata = data.slice( index,index + copysize );
		RecvData.push( copydata );
		RecvRead += copysize;
		index += copysize; remain -= copysize;

		if( RecvCode != null && RecvRead >= RecvSize ){ //読み込み完了
			var alldata = Buffer.concat( RecvData,RecvSize ); //バイト配列をバイナリ1データに
			console.log( 'data complete all size ' + alldata.length );
			var recvcode = RecvCode;
			//初期化
			RecvCode = null;
			RecvData = null;
			RecvSize = 0;
			RecvRead = 0;

			//返却データ分岐

			if(recvcode == 'T'){ //Simple Text
				var repdata = Buffer.from("あなたは「" + String(alldata) + "」と言いました");
				var rephead = Buffer.from('T' + ('0000000' + repdata.length).slice( -7 ));
				var repall = Buffer.concat([rephead,repdata]);
				pushReply(repall);
			}
			else if(recvcode == 'U'){ //画像URL取得
				Request({method: 'GET', url:String(alldata), encoding: null}, function (error, response, body) {
					var repdata = null;
					var rephead = null;
					var repall = null;
					if( error !== null ){
						console.error(error);
						repdata = Buffer.from(String(error));
						rephead = Buffer.from('T' + ('0000000' + repdata.length).slice( -7 ));
						repall = Buffer.concat([rephead,repdata]);
					}
					else{
						console.log('statusCode:', response.statusCode);
						var ctype = response.headers['content-type'];
						console.log('contentType:', ctype);
						if(ctype != null && ctype.indexOf('image') >= 0){
							repdata = Buffer.from(body);
							rephead = Buffer.from('I' + ('0000000' + repdata.length).slice( -7 ));
							repall = Buffer.concat([rephead,repdata]);
						}
						else{
							repdata = Buffer.from("指定URLの画像を取得できません");
							rephead = Buffer.from('T' + ('0000000' + repdata.length).slice( -7 ));
							repall = Buffer.concat([rephead,repdata]);
						}
					}
					pushReply(repall);
				});
			}
		}
	}

	if(!withoutResponse && callback != null){
		callback( this.RESULT_SUCCESS );
	}
};

function pushReply(data)
{
	if(data == null || data.length <= 0){
		return;
	}
	console.log( 'reply complete all size ' + data.length );
	ReplyArray.push( data );
	console.log( "saved to ReplyArray,arrays=" + ReplyArray.length );
	//返却準備完了通知
	if( PushCallback != null ){
		PushCallback( Buffer.from( 'N0000000' ) );
	}
}

MyCharacteristic.prototype.onReadRequest = function( offset,callback )
{ console.log('MyCharacteristic - onReadRequest offset = ' + offset );

	if( ReplyData == null ){
		var replydata = null;
		if(ReplyArray.length > 0){
			replydata = Buffer.from( ReplyArray.shift() );
		}
		if( replydata != null ){
			ReplyData = replydata;
			ReplySize = replydata.length;
			ReplyRead = 0;
		}
		else{ //返すデータはもう無い
			callback( this.RESULT_SUCCESS,'' );
			return;
		}
	}

	var remain = ReplySize - ReplyRead;
	var bytes = remain;
	if( bytes > MaxValueSize ) bytes = MaxValueSize;
	var buf = ReplyData.slice( ReplyRead,ReplyRead + bytes );
	ReplyRead += bytes;
	if( ReplyRead >= ReplySize ){ //1個送信完了
		ReplyData = null;
		ReplySize = 0;
		ReplyRead = 0;
	}

	callback( this.RESULT_SUCCESS,buf ); //返却
};

module.exports = MyCharacteristic;
