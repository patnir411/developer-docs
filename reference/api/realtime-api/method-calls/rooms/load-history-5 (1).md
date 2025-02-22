# Check If Room Name Exists

Check if a room name exists in a workspace.

| Name             | Requires Auth | Permission | Setting |
| ---------------- | ------------- | ---------- | ------- |
| `roomNameExists` | Yes           |            |         |

### Payload Parameters <a href="#payload-parameters" id="payload-parameters"></a>

| Argument   | Example | Required | Description                       |
| ---------- | ------- | -------- | --------------------------------- |
| `roomName` | `try`   | Required | The room name to be searched for. |

## Example Call

```javascript
{
    "msg": "method",
    "method": "roomNameExists",
    "id": "2",
    "params": [
                 "try"
    ]
}
```

## **Example Response**

### **Success**

```json
{
    "msg": "result",
    "id": "2",
    "result": false
}
```

{% hint style="info" %}
The `result` field returns a boolean to specify if the room exists in the workspace.
{% endhint %}
