<?php
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'GET':
        $query = "SELECT * FROM sales ORDER BY created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $sales = $stmt->fetchAll();
        
        foreach ($sales as &$sale) {
            $sale['items'] = json_decode($sale['items'], true) ?? [];
            $sale['imeis_sold'] = json_decode($sale['imeis_sold'], true) ?? [];
        }
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $sales]);
        break;
        
    case 'POST':
        $data = $input;
        
        // Iniciar transacción
        $db->beginTransaction();
        
        try {
            // Crear venta
            $query = "INSERT INTO sales (customer_id, customer_name, customer_phone, customer_email, customer_address, 
                      sale_date, items, imeis_sold, subtotal, tax_rate, tax, discount, total, 
                      payment_status, payment_method, credit_due_date, created_by) 
                      VALUES (:customer_id, :customer_name, :customer_phone, :customer_email, :customer_address, 
                      :sale_date, :items, :imeis_sold, :subtotal, :tax_rate, :tax, :discount, :total, 
                      :payment_status, :payment_method, :credit_due_date, :created_by)";
            
            $stmt = $db->prepare($query);
            $stmt->bindParam(':customer_id', $data['customerId']);
            $stmt->bindParam(':customer_name', $data['customerName']);
            $stmt->bindParam(':customer_phone', $data['customerPhone']);
            $stmt->bindParam(':customer_email', $data['customerEmail']);
            $stmt->bindParam(':customer_address', $data['customerAddress']);
            $stmt->bindParam(':sale_date', $data['date']);
            $items_json = json_encode($data['items']);
            $stmt->bindParam(':items', $items_json);
            $imeis_json = json_encode($data['imeisSold'] ?? []);
            $stmt->bindParam(':imeis_sold', $imeis_json);
            $stmt->bindParam(':subtotal', $data['subtotal']);
            $stmt->bindParam(':tax_rate', $data['taxRate']);
            $stmt->bindParam(':tax', $data['tax']);
            $discount = $data['discount'] ?? 0;
            $stmt->bindParam(':discount', $discount);
            $stmt->bindParam(':total', $data['total']);
            $stmt->bindParam(':payment_status', $data['paymentStatus']);
            $stmt->bindParam(':payment_method', $data['paymentMethod']);
            $stmt->bindParam(':credit_due_date', $data['creditDueDate']);
            $stmt->bindParam(':created_by', $_SESSION['user_email']);
            
            $stmt->execute();
            $sale_id = $db->lastInsertId();
            
            // Actualizar stock de productos
            foreach ($data['items'] as $item) {
                $updateQuery = "UPDATE products SET stock = stock - :quantity WHERE id = :id";
                $updateStmt = $db->prepare($updateQuery);
                $updateStmt->bindParam(':quantity', $item['quantity']);
                $updateStmt->bindParam(':id', $item['productId']);
                $updateStmt->execute();
                
                // Remover IMEIs vendidos si es celular
                if (isset($item['imeisSold']) && count($item['imeisSold']) > 0) {
                    $productQuery = "SELECT imeis FROM products WHERE id = :id";
                    $productStmt = $db->prepare($productQuery);
                    $productStmt->bindParam(':id', $item['productId']);
                    $productStmt->execute();
                    $product = $productStmt->fetch();
                    
                    $currentImeis = json_decode($product['imeis'], true) ?? [];
                    $remainingImeis = array_diff($currentImeis, $item['imeisSold']);
                    
                    $updateImeiQuery = "UPDATE products SET imeis = :imeis WHERE id = :id";
                    $updateImeiStmt = $db->prepare($updateImeiQuery);
                    $imeis_json = json_encode(array_values($remainingImeis));
                    $updateImeiStmt->bindParam(':imeis', $imeis_json);
                    $updateImeiStmt->bindParam(':id', $item['productId']);
                    $updateImeiStmt->execute();
                }
            }
            
            // Actualizar o crear cliente
            if ($data['customerId']) {
                $updateCustomer = "UPDATE customers SET total_purchases = total_purchases + :total, last_purchase = NOW() WHERE id = :id";
                $custStmt = $db->prepare($updateCustomer);
                $custStmt->bindParam(':total', $data['total']);
                $custStmt->bindParam(':id', $data['customerId']);
                $custStmt->execute();
            } elseif ($data['customerPhone']) {
                // Buscar si existe cliente con ese teléfono
                $findCustomer = "SELECT id FROM customers WHERE phone = :phone LIMIT 1";
                $findStmt = $db->prepare($findCustomer);
                $findStmt->bindParam(':phone', $data['customerPhone']);
                $findStmt->execute();
                
                if ($findStmt->rowCount() > 0) {
                    $customer = $findStmt->fetch();
                    $updateCustomer = "UPDATE customers SET total_purchases = total_purchases + :total, last_purchase = NOW() WHERE id = :id";
                    $custStmt = $db->prepare($updateCustomer);
                    $custStmt->bindParam(':total', $data['total']);
                    $custStmt->bindParam(':id', $customer['id']);
                    $custStmt->execute();
                } else {
                    // Crear nuevo cliente
                    $createCustomer = "INSERT INTO customers (name, phone, email, address, total_purchases, last_purchase, created_by) 
                                      VALUES (:name, :phone, :email, :address, :total_purchases, NOW(), :created_by)";
                    $custStmt = $db->prepare($createCustomer);
                    $custStmt->bindParam(':name', $data['customerName']);
                    $custStmt->bindParam(':phone', $data['customerPhone']);
                    $custStmt->bindParam(':email', $data['customerEmail']);
                    $custStmt->bindParam(':address', $data['customerAddress']);
                    $custStmt->bindParam(':total_purchases', $data['total']);
                    $custStmt->bindParam(':created_by', $_SESSION['user_email']);
                    $custStmt->execute();
                }
            }
            
            // Si es venta a crédito, crear cuenta por cobrar
            if ($data['paymentStatus'] === 'credit') {
                $arQuery = "INSERT INTO accounts_receivable (sale_id, customer_id, customer_name, amount, pending_amount, payments, due_date, status, created_by)
                           VALUES (:sale_id, :customer_id, :customer_name, :amount, :pending_amount, :payments, :due_date, 'pending', :created_by)";
                $arStmt = $db->prepare($arQuery);
                $arStmt->bindParam(':sale_id', $sale_id);
                $arStmt->bindParam(':customer_id', $data['customerId']);
                $arStmt->bindParam(':customer_name', $data['customerName']);
                $arStmt->bindParam(':amount', $data['total']);
                $arStmt->bindParam(':pending_amount', $data['total']);
                $payments_json = json_encode([]);
                $arStmt->bindParam(':payments', $payments_json);
                $arStmt->bindParam(':due_date', $data['creditDueDate']);
                $arStmt->bindParam(':created_by', $_SESSION['user_email']);
                $arStmt->execute();
            }
            
            $db->commit();
            
            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $sale_id]);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
        }
        break;
        
    case 'DELETE':
        $id = $_GET['id'] ?? null;
        
        $query = "DELETE FROM sales WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false]);
        }
        break;
}
?>
