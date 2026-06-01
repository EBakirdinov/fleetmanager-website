<?php

namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Symfony\Component\DependencyInjection\ContainerInterface;
use App\Service\AccountService;

class GlobalExtension extends AbstractExtension implements \Twig\Extension\GlobalsInterface
{
    private $container;

    private $accountService;

    private $logInfoFields = array(
        "tags" => "tags",
        "firstName" => "first name",
        "lastName" => "last name",
        "phone" => "phone",
        "phone2" => "phone 2",
        "email" => "email",
        "address" => "address",
        "address2" => "apartment, unit, suite, or floor",
        "city" => "city",
        "state" => "state",
        "zip" => "zip",
        "appointmentDate" => "appointment date",
        "amount" => "amount",
        "timeframe" => "timeframe",
        "paymentType" => "payment type",
        "source" => "source",
        "assignee" => "assignee",
        "discountAbsolute" => "absolute discount",
        "discountPercentage" => "percentage discount",
        "voucherNumber" => "voucher number",
        "confirmation" => "confirmation",
        "description" => "note",
        "isRecurring" => "recurring",
        "recurringGap" => "recurring gap"
    );

    private $recurringOptions = array(
        '0' => 'disabled',
        '1' => 'enabled',
        '2' => 'ongoing',
        '3' => 'completed',
    );

    private $recurringGapOptions = array(
        '1' => 'daily',
        '7' => 'weekly',
        '31' => 'monthly',
        '124' => 'quarterly',
        '182' => 'half-yearly',
        '365' => 'yearly',
    );

    private $favouriteTimeframes = array(154, 155, 156, 157, 158);

    public function __construct(ContainerInterface $container, AccountService $accountService)
    {
        $this->container = $container;

        $this->accountService = $accountService;
    }

    public function getGlobals(): array
    {
        $globals = $this->accountService->getUserData();

        return [
            'pdf_domain' => $this->container->getParameter('api_url'),
            'globalsUserData' => $globals,
            'logInfoFields' => $this->logInfoFields,
            'favouriteTimeframes' => $this->favouriteTimeframes,
            'recurringOptions' => $this->recurringOptions,
            'recurringGapOptions' => $this->recurringGapOptions
        ];
    }
}
