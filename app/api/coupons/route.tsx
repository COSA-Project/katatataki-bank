import sha256 from 'crypto-js/sha256';
import {kv} from "@vercel/kv";
import {NextRequest, NextResponse} from "next/server";

function hashSerialNumber(serialNumber: string, passCode: string) : string {
    return serialNumber + sha256(`${passCode}:${process.env.SALT}`);
}

function generateId() {
    let key = '';
    const length = 12;
    const characters = '0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        key += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return key;
}

export async function POST(
    req: NextRequest
) {
    const data = await req.json()
    // Validation
    const number = data['number']
    if (!number || number.toString() === '0' || number.toString().length <= 0 || number.toString().length >= 6 || !/^[0-9]+$/.test(number.toString())) {
        return NextResponse.json({
            'errorMessage': "次数应至少为 1 次且不超过 99999 次"
        }, { status: 400 })
    }

    const expiredAt = data['expiredAt']
    if (expiredAt && (expiredAt.toString().length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(expiredAt))) {
        return NextResponse.json({
            'errorMessage': "请以 yyyy-mm-dd 格式输入有效期"
        }, { status: 400 })
    }

    const passCode = data['passCode']
    if (!passCode || passCode.toString().length !== 5 || !/^[0-9]+$/.test(passCode.toString())) {
        return NextResponse.json({
            'errorMessage': "以 5 位数字的形式输入您的密码"
        }, { status: 400 })
    }

    let key = generateId()
    // すでに存在するかチェック
    let found = await kv.get(key)
    while (!!found) {
        key = generateId()
        found = await kv.get(key)
    }

    const createResponse = await kv.set(
        key,
        {
            hash: hashSerialNumber(key, passCode),
            expiredAt: expiredAt ? new Date(expiredAt).getTime() : null,
            number: number,
        }
    )
    if (createResponse !== "OK") {
        NextResponse.json({
            'errorMessage': "由于某种原因无法发行"
        }, { status: 500 })
    }

    return NextResponse.json({ 'serialNumber': key }, { status: 200 })
}

export async function PUT(
    req: NextRequest
) {
    const data = await req.json()

    // Validation
    const serialNumber = data['serialNumber']
    if (!serialNumber || serialNumber.toString().length !== 12 || !/^[0-9]+$/.test(serialNumber.toString())) {
        return NextResponse.json({
            'errorMessage': "序列号必须是 12 位数字"
        }, { status: 400 })
    }

    const passCode = data['passCode']
    if (!passCode || passCode.toString().length !== 5 || !/^[0-9]+$/.test(passCode.toString())) {
        return NextResponse.json({
            'errorMessage': "パスコードは5桁の数字で入力してください"
        }, { status: 400 })
    }

    const found = JSON.parse(JSON.stringify(await kv.get(serialNumber)))
    if (!found) {
        return NextResponse.json({
            'errorMessage': "序列号无效"
        }, { status: 404 })
    }

    const hash = hashSerialNumber(serialNumber, passCode);
    if (found['hash'] !== hash) {
        return NextResponse.json({
            "errorMessage": "密码错误"
        }, { status: 403 })
    }

    if (!!found['usedAt']) {
        return NextResponse.json({
            'message': "此券已使用"
        }, { status: 200 })
    }

    const now = new Date().getTime()
    const foundExpiredAt = found['expiredAt']
    if (!!foundExpiredAt && now > found['expiredAt']) {
        return NextResponse.json({
            'message': "此券已过期"
        }, { status: 200 })
    }

    const updateResponse = await kv.set(
        serialNumber,
        {
            ...found,
            usedAt: new Date().toISOString()
        }
    )

    if (updateResponse !== "OK") {
        NextResponse.json({
            'errorMessage': "由于某种原因导致验证失败"
        }, { status: 500 })
    }

    return NextResponse.json({
        'message': `${found['number']}本券已成功使用`
    }, { status: 200 })
}